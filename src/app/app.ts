import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Producto } from './services/api.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, finalize, timeout, tap, merge, map } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef;

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
  lastSearchedTerm: string = ''; // Track what we found

  selectedMonth: number = new Date().getMonth() + 1; // Current month
  selectedClientId: number | null = null;

  loading: boolean = false;

  months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  private autoSearchSubject = new Subject<string>();
  private manualSearchSubject = new Subject<string>();

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) { }

  isSearching: boolean = false; // For visual feedback

  ngOnInit() {
    // 1. Pipeline for Auto-Search (Debounced)
    const autoStream$ = this.autoSearchSubject.pipe(
      debounceTime(400),
      map(term => ({ term, isManual: false }))
    );

    // 2. Pipeline for Manual Search (Immediate - Enter/Button)
    const manualStream$ = this.manualSearchSubject.pipe(
      map(term => ({ term, isManual: true }))
    );

    // 3. Merged Pipeline
    merge(autoStream$, manualStream$).pipe(
      // Custom Distinct Logic: 
      // - Block if term is strictly same AND new is NOT manual. 
      // - Allow if term changed OR if it is a manual override (to force selection).
      distinctUntilChanged((prev, curr) => prev.term === curr.term && !curr.isManual),

      tap(() => {
        this.searchError = null;
        this.isSearching = true;
      }),

      switchMap(({ term, isManual }) => {
        return this.apiService.searchProducts(term).pipe(
          map(results => ({ results, isManual, term })), // Pass term through
          catchError(err => {
            console.error('Search API Error:', err);
            this.searchError = 'Ocurrió un error al buscar.';
            return of({ results: [], isManual, term });
          }),
          finalize(() => this.isSearching = false)
        );
      })
    ).subscribe(({ results, isManual, term }) => {
      this.searchResults = results;
      this.lastSearchedTerm = term; // Track what we found

      // Handle "No Results"
      if (results.length === 0 && term) {
        this.searchError = 'No se encontraron productos con ese nombre.';
        this.recommendations = [];
        this.selectedProduct = null;
        // Don't auto-hide error too fast, user needs to read it
      } else if (isManual && results.length > 0) {
        // Synergy: Exact Code Match Priority
        const cleanTerm = term.toUpperCase();
        const exactMatch = results.find(r => r.codigo && r.codigo.toUpperCase() === cleanTerm);

        if (exactMatch) {
          this.selectProduct(exactMatch);
        } else {
          // Fallback: Auto-Select first result
          this.selectProduct(results[0]);
        }
      }
    });

    this.loadSeasonalRecommendations();
    this.loadTopClients();
  }

  ngAfterViewInit() {
    // Auto-focus the search input
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
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
    this.searchError = null;
    if (this.selectedProduct && this.searchTerm !== this.selectedProduct.nombre) {
      this.selectedProduct = null;
      this.recommendations = [];
    }
    this.selectedIndex = -1;
    // Feed Auto-Search Pipeline
    this.autoSearchSubject.next(this.searchTerm.trim());
  }

  onKeyDown(event: KeyboardEvent) {
    // If no results yet, Enter should try to trigger a search or select first if loading finishes
    if (this.searchResults.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.onSearchButtonClick(); // Force search immediately
      }
      return;
    }

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
    const term = this.searchTerm.trim();
    if (!term) return;

    // OPTIMIZATION: If results are fresh and ready, use them!
    if (!this.isSearching && this.searchResults.length > 0 && term === this.lastSearchedTerm) {
      const cleanTerm = term.toUpperCase();

      // 1. Exact Code Match
      const exactMatch = this.searchResults.find(r => r.codigo && r.codigo.toUpperCase() === cleanTerm);
      if (exactMatch) {
        this.selectProduct(exactMatch);
        return;
      }

      // 2. Fallback to First Result ("I'm Feeling Lucky")
      this.selectProduct(this.searchResults[0]);
      return;
    }

    // Otherwise, trigger a fresh search
    this.manualSearchSubject.next(term);
  }

  recommendationSubtitle: string = 'Para que funcioné perfecto desde hoy';

  selectProduct(product: Producto) {
    this.selectedProduct = product;
    this.searchTerm = product.nombre;
    this.searchResults = [];
    this.isSearching = false; // Force stop searching visual

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
    this.cdr.detectChanges(); // Force update for loading state

    this.apiService.getRecommendations(productId).subscribe({
      next: (res) => {
        this.rawRecommendations = res;
        this.filterRecommendations();
        this.loading = false;
        this.cdr.detectChanges(); // Force update for results
      },
      error: (err) => {
        console.error('Error loading recommendations', err);
        this.loading = false;
        this.cdr.detectChanges(); // Force update for error state
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
