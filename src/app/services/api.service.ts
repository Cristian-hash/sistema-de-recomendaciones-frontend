import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Producto {
    id: number;
    codigo: string;
    nombre: string;
    descripcion?: string;
    ecomPrecio?: number;
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private apiUrl = 'http://localhost:5156/api/Recommendations';

    constructor(private http: HttpClient) { }

    searchProducts(term: string): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/search?q=${term}`);
    }

    getRecommendations(productId: number): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/${productId}`);
    }
}
