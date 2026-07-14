import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Favorite = {
  id: number;
  norad_id: number;
  sat_name: string;
  archived: number;
  created_at: string;
};

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);

  list(): Observable<Favorite[]> {
    return this.http.get<Favorite[]>('/api/favorites');
  }
  add(norad_id: number, sat_name: string): Observable<Favorite> {
    return this.http.post<Favorite>('/api/favorites', { norad_id, sat_name });
  }
  setArchived(id: number, archived: boolean): Observable<Favorite> {
    return this.http.patch<Favorite>(`/api/favorites/${id}`, { archived });
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/favorites/${id}`);
  }
}
