import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Producto } from './services/api.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  searchTerm: string = '';
  searchResults: Producto[] = [];
  selectedProduct: Producto | null = null;
  rawRecommendations: Producto[] = []; // Store raw recs
  recommendations: Producto[] = [];

  // Filter State
  selectedWarehouse: string = 'TODOS';
  warehouses: string[] = ['TODOS', 'A-Q001', 'A-Q002', 'A0001', 'C0001'];

  // New States
  seasonalRecommendations: Producto[] = [];
  clientRecommendations: Producto[] = [];
  topClients: number[] = [];

  selectedMonth: number = new Date().getMonth() + 1; // Current month
  selectedClientId: number | null = null;

  loading: boolean = false;

  months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  private searchSubject = new Subject<string>();

  constructor(private apiService: ApiService) { }

  isSearching: boolean = false; // For visual feedback

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      switchMap(term => {
        this.isSearching = true; // Start loading
        return this.apiService.searchProducts(term).pipe(
          catchError(err => {
            console.error('Search API Error:', err);
            return of([]);
          })
        );
      })
    ).subscribe(results => {
      this.isSearching = false; // Stop loading
      this.searchResults = results;
    });

    this.loadSeasonalRecommendations();
    this.loadTopClients();
  }

  filterRecommendations() {
    if (!this.rawRecommendations) return;

    if (this.selectedWarehouse === 'TODOS') {
      this.recommendations = this.rawRecommendations;
    } else {
      this.recommendations = this.rawRecommendations.filter(p =>
        p.almacen && p.almacen.toUpperCase().includes(this.selectedWarehouse)
      );
    }
  }

  onWarehouseChange() {
    this.filterRecommendations();
  }

  selectedIndex: number = -1;

  onSearchChange() {
    this.searchError = null; // Clear error when typing
    if (this.selectedProduct && this.searchTerm !== this.selectedProduct.nombre) {
      this.selectedProduct = null;
      this.recommendations = [];
    }
    this.selectedIndex = -1;
    this.searchSubject.next(this.searchTerm.trim()); // Trim on frontend too
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.searchResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % this.searchResults.length;
      event.preventDefault(); // Prevent cursor moving in input
    } else if (event.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex - 1 + this.searchResults.length) % this.searchResults.length;
      event.preventDefault();
    } else if (event.key === 'Enter') {
      event.preventDefault(); // Prevent double submit

      if (this.selectedIndex >= 0 && this.selectedIndex < this.searchResults.length) {
        // User explicitly navigated to an item
        this.selectProduct(this.searchResults[this.selectedIndex]);
      } else {
        // OPTIMIZATION: "I'm Feeling Lucky" - Select the first result contextually
        this.selectProduct(this.searchResults[0]);
      }
    } else if (event.key === 'Escape') {
      this.searchResults = [];
      this.selectedIndex = -1;
    }
  }

  searchError: string | null = null;

  onSearchButtonClick() {
    this.searchError = null; // Reset error
    if (this.searchTerm.trim()) {
      console.log('Searching for:', this.searchTerm);
      this.apiService.searchProducts(this.searchTerm).subscribe(results => {
        console.log('Results found:', results.length);
        this.searchResults = results;
        if (results.length === 0) {
          this.searchError = 'No se encontraron productos con ese nombre.';
          // Clear error after 3 seconds automatically
          setTimeout(() => this.searchError = null, 3000);
        }
      }, err => {
        console.error('Search error:', err);
        this.searchError = 'Ocurrió un error al buscar.';
      });
    }
  }

  recommendationSubtitle: string = 'Para que funcioné perfecto desde hoy';

  selectProduct(product: Producto) {
    this.selectedProduct = product;
    this.searchTerm = product.nombre;
    this.searchResults = [];

    // Dynamic Subtitle Logic
    const name = product.nombre.toUpperCase();
    if (name.includes('RAM') || name.includes('SSD') || name.includes('SOLID') || name.includes('DDR')) {
      this.recommendationSubtitle = 'Para que tu PC se sienta nueva hoy mismo';
    } else {
      this.recommendationSubtitle = 'Para que funcioné perfecto desde hoy';
    }

    this.loadRecommendations(product.id);
  }

  loadRecommendations(productId: number) {
    this.loading = true;
    this.apiService.getRecommendations(productId).subscribe({
      next: (res) => {
        this.rawRecommendations = res; // Save raw
        this.filterRecommendations(); // Apply initial filter
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading recommendations', err);
        this.loading = false;
      }
    });
  }

  // New Methods
  loadSeasonalRecommendations() {
    this.apiService.getSeasonalRecommendations(this.selectedMonth).subscribe(res => {
      this.seasonalRecommendations = res;
    });
  }

  onMonthChange() {
    this.loadSeasonalRecommendations();
  }

  loadTopClients() {
    this.apiService.getTopClients().subscribe(res => {
      this.topClients = res;
      // Select the first one by default just to show something
      if (res.length > 0) {
        this.selectClient(res[0]);
      }
    });
  }

  selectClient(clientId: number) {
    this.selectedClientId = clientId;
    this.apiService.getClientRecommendations(clientId).subscribe(res => {
      this.clientRecommendations = res;
    });
  }
}
