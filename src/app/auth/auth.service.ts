import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';

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

  constructor() {
    // Diferido a microtask: el auth interceptor hace inject(AuthService) en
    // cada request, y disparar el GET /api/me de forma síncrona acá dentro
    // reentra en la resolución de DI de este mismo servicio (NG0200,
    // circular dependency) porque todavía no terminó de construirse.
    if (this._token()) queueMicrotask(() => this.rehydrate());
  }

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

  // Al iniciar con token guardado, recupera el user autenticado; si el token
  // ya no es válido (401), limpia la sesión.
  private rehydrate(): void {
    this.http.get<User>('/api/me').subscribe({
      next: (u) => this._user.set(u),
      error: () => this.logout(),
    });
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
