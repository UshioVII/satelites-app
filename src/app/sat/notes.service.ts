import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';

export type Note = { norad_id: number; body: string; updated_at: string };

@Injectable({ providedIn: 'root' })
export class NotesService {
  private http = inject(HttpClient);

  get(noradId: number): Observable<Note | null> {
    return this.http.get<Note>(`/api/notes/${noradId}`).pipe(catchError(() => of(null)));
  }
  save(noradId: number, body: string): Observable<Note> {
    return this.http.put<Note>(`/api/notes/${noradId}`, { body });
  }
  remove(noradId: number): Observable<void> {
    return this.http.delete<void>(`/api/notes/${noradId}`);
  }
}
