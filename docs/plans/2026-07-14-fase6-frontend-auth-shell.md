# Fase 6 — Frontend auth + shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la app de un solo componente-globo en una app con router, autenticación por token JWT (login/registro/sesión), Home informativa y rutas protegidas — consumiendo el backend de la fase 6.

**Architecture:** Se refactoriza el componente `App` (hoy es el globo) en un **shell** con navbar + `<router-outlet>`, y el globo se mueve intacto a `GlobeComponent`. Un `AuthService` (signals + localStorage) maneja la sesión; un interceptor funcional agrega el `Bearer`; un guard funcional protege rutas. Angular 22 standalone, signals, sin NgModules.

**Tech Stack:** Angular 22 (standalone, signals, functional interceptors/guards), HttpClient, Reactive Forms, Vitest (`ng test`).

## Global Constraints

- Angular 22 standalone components; NO NgModules. Usar `input()`/`signal()`/`inject()`, control flow `@if/@for/@switch`.
- El backend expone `/api/*` (proxy en dev). Contrato: `POST /api/register` y `POST /api/login` → `{ token, user }`; `GET /api/me` → user. `user` = `{id, email, display_name, home_lat, home_lng, viz_mode, avatar}`.
- El token JWT se guarda en `localStorage` bajo la clave `sat_token`.
- Tests estilo del repo: `describe/it/expect` + `TestBed`; para HTTP usar `provideHttpClient()` + `provideHttpClientTesting()` y `HttpTestingController`.
- No romper el globo existente: su lógica (`satellites.service.ts`, propagación, overhead, pases, fallback TLE) no se toca; solo se mueve de archivo.
- Rutas: `/` (Home), `/globe` (globo), `/login`, `/register`, `/profile` (protegida), `/stats` (protegida). `/profile` y `/stats` se crean en planes posteriores; acá se dejan las rutas de auth y se protege con el guard ya listo.

---

## File Structure

- `src/app/auth/auth.service.ts` — sesión: `register()`, `login()`, `logout()`, `token()`, `user` (signal), `isLoggedIn` (computed). Persiste en localStorage.
- `src/app/auth/auth.interceptor.ts` — `authInterceptor`: functional `HttpInterceptorFn`, agrega `Authorization: Bearer` a requests `/api` cuando hay token.
- `src/app/auth/auth.guard.ts` — `authGuard`: functional `CanActivateFn`, redirige a `/login` si no hay sesión.
- `src/app/globe/globe.ts` + `globe.html` + `globe.css` — el globo actual, movido desde `app.*`.
- `src/app/shell/shell.ts` — nuevo `App` shell: navbar + `<router-outlet>`.
- `src/app/pages/home.ts` — landing informativa.
- `src/app/pages/login.ts` — form de login.
- `src/app/pages/register.ts` — form de registro.
- `src/app/app.routes.ts` — rutas.
- `src/app/app.config.ts` — agrega `withInterceptors([authInterceptor])`.

---

## Task 1: AuthService

**Files:**
- Create: `src/app/auth/auth.service.ts`
- Test: `src/app/auth/auth.service.spec.ts`

**Interfaces:**
- Produces: `AuthService` con:
  - `user: Signal<User | null>` (signal de solo lectura via `.asReadonly()`)
  - `isLoggedIn: Signal<boolean>` (computed: `!!user()`)
  - `token(): string | null`
  - `register(email, password, display_name): Observable<User>`
  - `login(email, password): Observable<User>`
  - `logout(): void`
  - `type User = { id: number; email: string; display_name: string; home_lat: number|null; home_lng: number|null; viz_mode: string; avatar: string }`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/auth/auth.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

const USER = { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' };

describe('AuthService', () => {
  let svc: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('login guarda token y user', () => {
    let got: any;
    svc.login('a@b.com', 'secreto12').subscribe((u) => (got = u));
    const req = http.expectOne('/api/login');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt123', user: USER });
    expect(got).toEqual(USER);
    expect(svc.token()).toBe('jwt123');
    expect(svc.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('sat_token')).toBe('jwt123');
  });

  it('logout limpia sesión', () => {
    svc.login('a@b.com', 'secreto12').subscribe();
    http.expectOne('/api/login').flush({ token: 'jwt123', user: USER });
    svc.logout();
    expect(svc.token()).toBeNull();
    expect(svc.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('sat_token')).toBeNull();
  });

  it('register hace POST a /api/register', () => {
    svc.register('a@b.com', 'secreto12', 'Ana').subscribe();
    const req = http.expectOne('/api/register');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt123', user: USER });
    expect(svc.token()).toBe('jwt123');
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: FAIL con `Cannot find module './auth.service'` o error de resolución.

- [ ] **Step 3: Implementar auth.service.ts**

Crear `src/app/auth/auth.service.ts`:
```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: los 3 tests de AuthService PASAN (junto al resto de la suite existente).

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/auth/auth.service.ts src/app/auth/auth.service.spec.ts
git commit -m "feat(front): AuthService con sesión JWT en localStorage"
```

---

## Task 2: Auth interceptor

**Files:**
- Create: `src/app/auth/auth.interceptor.ts`
- Modify: `src/app/app.config.ts`
- Test: `src/app/auth/auth.interceptor.spec.ts`

**Interfaces:**
- Consumes: `AuthService.token()` (Task 1).
- Produces: `authInterceptor: HttpInterceptorFn` que agrega `Authorization: Bearer <token>` a requests cuya URL empieza con `/api` cuando hay token; los demás requests pasan sin tocar.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/auth/auth.interceptor.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('agrega Bearer a /api cuando hay token', () => {
    localStorage.setItem('sat_token', 'jwt123');
    http.get('/api/me').subscribe();
    const req = ctrl.expectOne('/api/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt123');
    req.flush({});
  });

  it('no agrega header sin token', () => {
    http.get('/api/me').subscribe();
    const req = ctrl.expectOne('/api/me');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  afterEach(() => ctrl.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: FAIL con módulo `./auth.interceptor` no encontrado.

- [ ] **Step 3: Implementar auth.interceptor.ts**

Crear `src/app/auth/auth.interceptor.ts`:
```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (token && req.url.startsWith('/api')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
```

- [ ] **Step 4: Registrar el interceptor en app.config.ts**

En `src/app/app.config.ts`, reemplazar la línea `provideHttpClient(),` por:
```ts
    provideHttpClient(withInterceptors([authInterceptor])),
```
y agregar los imports arriba:
```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';
```
(quitar el import viejo de `provideHttpClient` para no duplicarlo).

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: los 2 tests del interceptor PASAN; el resto sigue verde.

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add src/app/auth/auth.interceptor.ts src/app/auth/auth.interceptor.spec.ts src/app/app.config.ts
git commit -m "feat(front): interceptor que agrega Bearer a /api"
```

---

## Task 3: Auth guard

**Files:**
- Create: `src/app/auth/auth.guard.ts`
- Test: `src/app/auth/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `AuthService.isLoggedIn()` (Task 1).
- Produces: `authGuard: CanActivateFn` → `true` si hay sesión; si no, navega a `/login` y devuelve `false`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/auth/auth.guard.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { runInInjectionContext } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let router: { navigate: any };
  let loggedIn = false;

  beforeEach(() => {
    router = { navigate: (...a: any[]) => {} };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        { provide: Router, useValue: router },
      ],
    });
  });

  function run() {
    return runInInjectionContext(TestBed, () => authGuard({} as any, {} as any));
  }

  it('deja pasar con sesión', () => {
    loggedIn = true;
    expect(run()).toBe(true);
  });

  it('bloquea y redirige sin sesión', () => {
    loggedIn = false;
    let navegoA: any;
    router.navigate = (a: any[]) => (navegoA = a);
    expect(run()).toBe(false);
    expect(navegoA).toEqual(['/login']);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: FAIL con módulo `./auth.guard` no encontrado.

- [ ] **Step 3: Implementar auth.guard.ts**

Crear `src/app/auth/auth.guard.ts`:
```ts
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  inject(Router).navigate(['/login']);
  return false;
};
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: los 2 tests del guard PASAN.

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/auth/auth.guard.ts src/app/auth/auth.guard.spec.ts
git commit -m "feat(front): guard que protege rutas sin sesión"
```

---

## Task 4: Mover el globo a GlobeComponent + shell con router-outlet

**Files:**
- Create: `src/app/globe/globe.ts`, `src/app/globe/globe.html`, `src/app/globe/globe.css`, `src/app/globe/globe.spec.ts`
- Modify: `src/app/app.ts` (pasa a ser el shell), `src/app/app.html`, `src/app/app.css`, `src/app/app.spec.ts`
- Modify: `src/app/app.routes.ts`
- Delete: (ninguno — se reutiliza el contenido)

**Interfaces:**
- Produces: `GlobeComponent` (selector `app-globe`) con TODA la lógica y template del `App` actual. `App` (selector `app-root`) queda como shell: navbar + `<router-outlet>`.

- [ ] **Step 1: Crear GlobeComponent moviendo el contenido actual de App**

Copiar `src/app/app.ts` → `src/app/globe/globe.ts`, renombrando la clase `App` a `Globe` y ajustando:
- `selector: 'app-globe'`
- `templateUrl: './globe.html'`, `styleUrl: './globe.css'`
Mover `src/app/app.html` → `src/app/globe/globe.html` (sin cambios de contenido) y `src/app/app.css` → `src/app/globe/globe.css` (sin cambios). Ajustar el import del servicio en `globe.ts` a la ruta nueva: `import { SatellitesService, ... } from '../satellites.service';`.

El contenido de `globe.ts` es el `app.ts` actual con estos cambios de cabecera:
```ts
// (mismos imports que app.ts, pero el de satellites.service pasa a '../satellites.service')
@Component({
  selector: 'app-globe',
  imports: [DecimalPipe, DatePipe],
  templateUrl: './globe.html',
  styleUrl: './globe.css',
})
export class Globe implements OnDestroy {
  // ... cuerpo idéntico al App actual ...
}
```

- [ ] **Step 2: Mover el spec del globo**

Copiar `src/app/app.spec.ts` → `src/app/globe/globe.spec.ts`, cambiando `App`→`Globe` y el import a `./globe`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Globe } from './globe';

describe('Globe', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Globe);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

- [ ] **Step 3: Convertir App en shell**

Reemplazar `src/app/app.ts` por el shell:
```ts
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
}
```

Reemplazar `src/app/app.html` por la navbar + outlet:
```html
<nav class="nav">
  <a class="brand" routerLink="/">🛰️ Satélites</a>
  <a routerLink="/globe" routerLinkActive="active">Globo</a>
  @if (auth.isLoggedIn()) {
    <a routerLink="/profile" routerLinkActive="active">Perfil</a>
    <a routerLink="/stats" routerLinkActive="active">Stats</a>
    <button class="link" (click)="auth.logout()">Salir</button>
  } @else {
    <a routerLink="/login" routerLinkActive="active">Entrar</a>
  }
</nav>
<router-outlet />
```

Reemplazar `src/app/app.css` por estilos de navbar (tema oscuro, acorde al globo):
```css
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  background: #0b0f1a;
  border-bottom: 1px solid #1e2636;
  font-size: 0.95rem;
}
.nav a {
  color: #9fb3c8;
  text-decoration: none;
}
.nav a.active {
  color: #00e5ff;
}
.nav .brand {
  font-weight: 700;
  color: #e6f1ff;
  margin-right: auto;
}
.nav .link {
  background: none;
  border: none;
  color: #9fb3c8;
  cursor: pointer;
  font: inherit;
}
```

- [ ] **Step 4: Actualizar el spec del shell**

Reemplazar `src/app/app.spec.ts` por un test de shell (sin HttpClient real; AuthService se puede injectar tal cual porque no fetchea en el constructor):
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza la navbar con la marca', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Satélites');
  });
});
```

- [ ] **Step 5: Registrar la ruta del globo**

Reemplazar `src/app/app.routes.ts`:
```ts
import { Routes } from '@angular/router';
import { Globe } from './globe/globe';

export const routes: Routes = [
  { path: 'globe', component: Globe },
  { path: '', pathMatch: 'full', redirectTo: 'globe' },
];
```
(El `''` redirige a `/globe` por ahora; el Home lo reemplaza en Task 6.)

- [ ] **Step 6: Correr tests y build**

Run: `cd "D:/satelites-app" && npx ng test --watch=false && npx ng build`
Expected: toda la suite verde (Globe + shell + auth) y `ng build` sin errores.

- [ ] **Step 7: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe src/app/app.ts src/app/app.html src/app/app.css src/app/app.spec.ts src/app/app.routes.ts
git commit -m "refactor(front): globo a GlobeComponent, App pasa a shell con router-outlet"
```

---

## Task 5: Login y Register

**Files:**
- Create: `src/app/pages/login.ts`, `src/app/pages/register.ts`
- Test: `src/app/pages/login.spec.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AuthService.login/register` (Task 1), `Router`.
- Produces: `Login` (`app-login`) y `Register` (`app-register`), componentes standalone con Reactive Forms que en éxito navegan a `/globe` y muestran el error del backend en fallo.

- [ ] **Step 1: Escribir el test que falla (login)**

Crear `src/app/pages/login.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('en éxito navega a /globe', () => {
    const fixture = TestBed.createComponent(Login);
    const cmp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    let nav: any;
    (router as any).navigate = (a: any[]) => (nav = a);
    cmp.form.setValue({ email: 'a@b.com', password: 'secreto12' });
    cmp.submit();
    http.expectOne('/api/login').flush({ token: 't', user: { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' } });
    expect(nav).toEqual(['/globe']);
  });

  it('en error muestra el mensaje del backend', () => {
    const fixture = TestBed.createComponent(Login);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ email: 'a@b.com', password: 'mala1234' });
    cmp.submit();
    http.expectOne('/api/login').flush({ error: 'credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });
    expect(cmp.error()).toBe('credenciales inválidas');
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: FAIL con módulo `./login` no encontrado.

- [ ] **Step 3: Implementar login.ts**

Crear `src/app/pages/login.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Entrar</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <input formControlName="email" type="email" placeholder="email" autocomplete="email" />
        <input formControlName="password" type="password" placeholder="contraseña" autocomplete="current-password" />
        <button type="submit" [disabled]="form.invalid || loading()">Entrar</button>
      </form>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <p>¿No tenés cuenta? <a routerLink="/register">Registrate</a></p>
    </section>
  `,
  styleUrl: './auth-form.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/globe']),
      error: (e) => {
        this.error.set(e?.error?.error ?? 'No se pudo entrar');
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 4: Implementar register.ts**

Crear `src/app/pages/register.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="card">
      <h1>Crear cuenta</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <input formControlName="display_name" placeholder="nombre" autocomplete="nickname" />
        <input formControlName="email" type="email" placeholder="email" autocomplete="email" />
        <input formControlName="password" type="password" placeholder="contraseña (8+)" autocomplete="new-password" />
        <button type="submit" [disabled]="form.invalid || loading()">Registrarme</button>
      </form>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <p>¿Ya tenés cuenta? <a routerLink="/login">Entrar</a></p>
    </section>
  `,
  styleUrl: './auth-form.css',
})
export class Register {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    display_name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password, display_name } = this.form.getRawValue();
    this.auth.register(email, password, display_name).subscribe({
      next: () => this.router.navigate(['/globe']),
      error: (e) => {
        this.error.set(e?.error?.error ?? 'No se pudo registrar');
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 5: Estilos compartidos del form**

Crear `src/app/pages/auth-form.css`:
```css
.card {
  max-width: 22rem;
  margin: 3rem auto;
  padding: 1.5rem;
  background: #0b0f1a;
  border: 1px solid #1e2636;
  border-radius: 12px;
  color: #e6f1ff;
}
.card h1 { margin: 0 0 1rem; font-size: 1.3rem; }
.card form { display: flex; flex-direction: column; gap: 0.6rem; }
.card input {
  padding: 0.6rem;
  background: #060911;
  border: 1px solid #1e2636;
  border-radius: 8px;
  color: #e6f1ff;
}
.card button {
  padding: 0.6rem;
  background: #00e5ff;
  color: #051018;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}
.card button:disabled { opacity: 0.5; cursor: not-allowed; }
.card .err { color: #ff6b6b; }
.card a { color: #00e5ff; }
```

- [ ] **Step 6: Registrar las rutas de auth**

En `src/app/app.routes.ts`, agregar (import lazy con `loadComponent` para no cargarlas en el bundle inicial):
```ts
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register').then((m) => m.Register) },
```
Dejar la ruta `''` redirect y `globe` como estaban; agregar estas dos antes del redirect `''`.

- [ ] **Step 7: Correr tests y build**

Run: `cd "D:/satelites-app" && npx ng test --watch=false && npx ng build`
Expected: los 2 tests de Login PASAN, suite completa verde, `ng build` sin errores.

- [ ] **Step 8: Commit**

```bash
cd "D:/satelites-app" && git add src/app/pages/login.ts src/app/pages/register.ts src/app/pages/login.spec.ts src/app/pages/auth-form.css src/app/app.routes.ts
git commit -m "feat(front): páginas de login y registro con reactive forms"
```

---

## Task 6: Home informativa

**Files:**
- Create: `src/app/pages/home.ts`, `src/app/pages/home.spec.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Produces: `Home` (`app-home`), landing con info del proyecto y CTA a `/globe` y `/login`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pages/home.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el título y un CTA al globo', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent ?? '').toContain('Satélites');
    const link = el.querySelector('a[href="/globe"]');
    expect(link).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && npx ng test --watch=false`
Expected: FAIL con módulo `./home` no encontrado.

- [ ] **Step 3: Implementar home.ts**

Crear `src/app/pages/home.ts`:
```ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <h1>🛰️ Satélites</h1>
      <p class="lead">
        Visualizador 3D de satélites en tiempo real. Seguí la Estación Espacial y cientos de
        objetos en órbita, mirá qué tenés sobre tu cabeza ahora mismo y predecí sus próximos pases.
      </p>
      <ul class="feats">
        <li>Globo 3D en vivo con datos TLE reales (CelesTrak)</li>
        <li>Elegí un satélite y vé su órbita, telemetría e info de Wikipedia</li>
        <li>Guardá favoritos y notas, con tu perfil y estadísticas</li>
      </ul>
      <div class="cta">
        <a class="btn" routerLink="/globe">Ver el globo</a>
        <a class="btn ghost" routerLink="/login">Entrar</a>
      </div>
      <p class="stack">Angular 22 · globe.gl · satellite.js · Node/Express + SQLite</p>
    </section>
  `,
  styles: [`
    .hero { max-width: 46rem; margin: 3rem auto; padding: 0 1.2rem; color: #e6f1ff; }
    .hero h1 { font-size: 2.4rem; margin: 0 0 0.5rem; }
    .lead { color: #9fb3c8; font-size: 1.1rem; line-height: 1.6; }
    .feats { color: #c8d6e5; line-height: 1.8; }
    .cta { display: flex; gap: 0.8rem; margin: 1.4rem 0; }
    .btn { padding: 0.7rem 1.2rem; border-radius: 8px; background: #00e5ff; color: #051018; text-decoration: none; font-weight: 700; }
    .btn.ghost { background: transparent; color: #00e5ff; border: 1px solid #00e5ff; }
    .stack { color: #5b6b7f; font-size: 0.85rem; }
  `],
})
export class Home {}
```

- [ ] **Step 4: Registrar la ruta Home**

En `src/app/app.routes.ts`, reemplazar el redirect `''` para que apunte al Home:
```ts
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home').then((m) => m.Home) },
```
(sacar el `redirectTo: 'globe'`).

- [ ] **Step 5: Correr tests y build**

Run: `cd "D:/satelites-app" && npx ng test --watch=false && npx ng build`
Expected: test de Home PASA, suite completa verde, build ok.

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add src/app/pages/home.ts src/app/pages/home.spec.ts src/app/app.routes.ts
git commit -m "feat(front): Home informativa con CTA"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (del spec, subsistema auth+shell):** AuthService/sesión JWT ✓ (T1); interceptor Bearer ✓ (T2); guard rutas protegidas ✓ (T3); refactor globo→GlobeComponent + shell con router-outlet + navbar ✓ (T4); login/register con reactive forms + errores del backend ✓ (T5); Home informativa ✓ (T6).
- **Fuera de este plan (planes siguientes):** `/profile` (editar + favoritos + avatar picker), `/stats` (chart.js), panel Wikipedia + notas en el globo, heatmap/hexbin + persistencia viz_mode, pulido del globo, pantallas de carga presentables. Las rutas `/profile` y `/stats` se agregan cuando existan esos componentes (protegidas con `authGuard`).
- **Consistencia de tipos:** `AuthService` (`user`, `isLoggedIn`, `token()`, `login/register/logout`, tipo `User`) usado igual en interceptor, guard, login, register y shell. Clave localStorage `sat_token` idéntica en service, interceptor y specs.
- **Nota de integración:** el shell importa `AuthService` que no fetchea en el constructor, así que los tests que crean `App` no necesitan `HttpTestingController` salvo por el provider; se incluye igual para el árbol de DI.
