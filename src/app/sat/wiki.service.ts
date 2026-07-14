import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, shareReplay } from 'rxjs';

export type WikiSummary = { title: string; extract: string; thumbnail: string | null; url: string };

@Injectable({ providedIn: 'root' })
export class WikiService {
  private http = inject(HttpClient);
  private cache = new Map<string, Observable<WikiSummary | null>>();

  // Limpia el nombre del TLE para buscar en Wikipedia: saca lo que va entre paréntesis y recorta.
  private clean(name: string): string {
    return name.replace(/\(.*?\)/g, '').trim();
  }

  summary(name: string): Observable<WikiSummary | null> {
    const title = this.clean(name);
    if (!title) return of(null);
    let cached = this.cache.get(title);
    if (!cached) {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      cached = this.http.get<any>(url).pipe(
        map((r) => (r && r.extract ? {
          title: r.title,
          extract: r.extract,
          thumbnail: r.thumbnail?.source ?? null,
          url: r.content_urls?.desktop?.page ?? '',
        } : null)),
        catchError(() => of(null)),
        shareReplay(1),
      );
      this.cache.set(title, cached);
    }
    return cached;
  }
}
