import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Producto } from './services/api.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

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
  recommendations: Producto[] = [];

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
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.apiService.searchProducts(term))
    ).subscribe(results => {
      this.searchResults = results;
    });

    this.loadSeasonalRecommendations();
    this.loadTopClients();
  }

  onSearchChange() {
    // Si el usuario empieza a escribir algo nuevo/distinto, limpiamos la selección anterior
    if (this.selectedProduct && this.searchTerm !== this.selectedProduct.nombre) {
      this.selectedProduct = null;
      this.recommendations = [];
    }
    this.searchSubject.next(this.searchTerm);
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
        this.recommendations = res;
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
