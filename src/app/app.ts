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
  loading: boolean = false;

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
  }

  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchButtonClick() {
    if (this.searchTerm.trim()) {
      this.apiService.searchProducts(this.searchTerm).subscribe(results => {
        this.searchResults = results;
        if (results.length > 0) {
          // Si hay resultados, bajamos el dropdown
        }
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
}
