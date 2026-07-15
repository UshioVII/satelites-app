import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type Favorite = {
  id: number;
  norad_id: number;
  sat_name: string;
  color: string | null;
  archived: number;
  created_at: string;
};

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);

  // Caché compartida: la comparten el perfil (lista) y el globo (colores). Se refresca tras cada cambio.
  private _items = signal<Favorite[]>([]);
  readonly items = this._items.asReadonly();
  // norad -> color de los favoritos activos, para pintar esos satélites en el globo.
  readonly colorByNorad = computed(() => {
    const m = new Map<number, string>();
    for (const f of this._items()) if (!f.archived && f.color) m.set(f.norad_id, f.color);
    return m;
  });

  reload(): void {
    this.http.get<Favorite[]>('/api/favorites').subscribe((f) => this._items.set(f));
  }

  list(): Observable<Favorite[]> {
    return this.http.get<Favorite[]>('/api/favorites');
  }
  add(norad_id: number, sat_name: string, color?: string): Observable<Favorite> {
    const body = color ? { norad_id, sat_name, color } : { norad_id, sat_name };
    return this.http.post<Favorite>('/api/favorites', body).pipe(tap(() => this.reload()));
  }
  setColor(id: number, color: string): Observable<Favorite> {
    return this.http.patch<Favorite>(`/api/favorites/${id}`, { color }).pipe(tap(() => this.reload()));
  }
  setArchived(id: number, archived: boolean): Observable<Favorite> {
    return this.http.patch<Favorite>(`/api/favorites/${id}`, { archived }).pipe(tap(() => this.reload()));
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/favorites/${id}`).pipe(tap(() => this.reload()));
  }
}
