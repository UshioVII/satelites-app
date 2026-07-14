import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';

export type User = {
  id: number;
  email: string;
  display_name: string;
  home_lat: number | null;
  home_lng: number | null;
  viz_mode: string;
  avatar: string;
};

const TOKEN_KEY = 'sat_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user = signal<User | null>(null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());

  token(): string | null {
    return this._token();
  }

  register(email: string, password: string, display_name: string): Observable<User> {
    return this.auth('/api/register', { email, password, display_name });
  }

  login(email: string, password: string): Observable<User> {
    return this.auth('/api/login', { email, password });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  updateProfile(patch: Partial<Pick<User, 'display_name' | 'home_lat' | 'home_lng' | 'viz_mode' | 'avatar'>>): Observable<User> {
    return this.http.patch<User>('/api/me', patch).pipe(tap((u) => this._user.set(u)));
  }

  uploadAvatar(file: File): Observable<User> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatar: string; user: User }>('/api/avatar', form).pipe(
      map((res) => res.user),
      tap((u) => this._user.set(u)),
    );
  }

  // Recupera el user autenticado a partir del token guardado. Llamada desde
  // el appInitializer (ver app.config.ts) para bloquear la navegación
  // inicial del router hasta que la sesión esté resuelta. Si el token ya no
  // es válido (401), limpia la sesión; otros errores (5xx, red) no tocan un
  // token que puede seguir siendo válido. Siempre completa, para no colgar
  // el bootstrap.
  rehydrate(): Observable<unknown> {
    return this.http.get<User>('/api/me').pipe(
      tap((u) => this._user.set(u)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) this.logout();
        return of(null);
      }),
    );
  }

  // Guarda token+user de la respuesta {token, user} y devuelve el user.
  private auth(url: string, body: object): Observable<User> {
    return this.http.post<{ token: string; user: User }>(url, body).pipe(
      tap(({ token }) => {
        localStorage.setItem(TOKEN_KEY, token);
        this._token.set(token);
      }),
      tap(({ user }) => this._user.set(user)),
      map(({ user }) => user),
    );
  }
}
