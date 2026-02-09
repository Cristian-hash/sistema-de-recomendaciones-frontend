import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Producto {
    id: number;
    codigo: string;
    nombre: string;
    descripcion?: string;
    ecomPrecio?: number;
    razon?: string;
    stock?: number;
    almacen?: string;
    features?: string[];
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private apiUrl = 'https://recomendador.grupoupgrade.com.pe/api/Recommendations';

    constructor(private http: HttpClient) { }

    searchProducts(term: string): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/search?q=${term}`);
    }

    getRecommendations(productId: number): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/${productId}`);
    }

    getSeasonalRecommendations(month: number): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/seasonal?month=${month}`);
    }

    getClientRecommendations(clientId: number): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.apiUrl}/client/${clientId}`);
    }

    getTopClients(): Observable<number[]> {
        return this.http.get<number[]>(`${this.apiUrl}/clients/top`);
    }
}
