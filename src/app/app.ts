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
  warehouses: string[] = ['TODOS', 'QUIÑONES', 'RIVERO', 'CUZCO'];

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

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      switchMap(term => this.apiService.searchProducts(term).pipe(
        catchError(err => {
          console.error('Search API Error:', err);
          return of([]);
        })
      ))
    ).subscribe(results => {
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

  onSearchButtonClick() {
    if (this.searchTerm.trim()) {
      console.log('Searching for:', this.searchTerm); // Log for debugging
      this.apiService.searchProducts(this.searchTerm).subscribe(results => {
        console.log('Results found:', results.length); // Log for debugging
        this.searchResults = results;
        if (results.length === 0) {
          alert('No se encontraron productos con ese nombre.');
        }
      }, err => {
        console.error('Search error:', err);
      });
    }
  }

  selectProduct(product: Producto) {
    this.selectedProduct = product;
    this.searchTerm = product.nombre;
    this.searchResults = [];
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
