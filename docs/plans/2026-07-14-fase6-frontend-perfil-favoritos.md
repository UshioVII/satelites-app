# Fase 6 — Frontend perfil + favoritos + avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página de perfil protegida donde el usuario edita su nombre, ubicación de casa y avatar (planetas prearmados o imagen/gif propia), y ve/gestiona sus favoritos (activos y archivados).

**Architecture:** Un `FavoritesService` (CRUD contra `/api/favorites`) y métodos de perfil en el `AuthService` existente (`updateProfile`, `uploadAvatar`) que actualizan el signal `user`. Un componente de presentación `Avatar` (círculo-planeta por CSS o `<img>` para uploads). Una página `Profile` (ruta `/profile`, protegida por `authGuard`) que integra todo.

**Tech Stack:** Angular 22 standalone, signals, Reactive Forms, HttpClient, Vitest.

## Global Constraints

- Angular 22 standalone; no NgModules; `signal()`/`computed()`/`inject()`, control flow `@if/@for`.
- Backend (ya existe, proxy `/api`):
  - `GET /api/me` → `User`. `PATCH /api/me` con `{display_name?, home_lat?, home_lng?, viz_mode?, avatar?}` → `User`. `avatar` acá solo acepta `preset:<id>`.
  - `POST /api/avatar` multipart campo `file` (imagen/gif) → `{ avatar, user }`.
  - `GET /api/favorites` → `Favorite[]` (activos y archivados). `POST /api/favorites {norad_id, sat_name}` → `Favorite` (409 si ya existe). `PATCH /api/favorites/:id {archived}` → `Favorite`. `DELETE /api/favorites/:id` → 204.
- Tipos: `User = {id,email,display_name,home_lat,home_lng,viz_mode,avatar}` (ya en `auth.service.ts`). `Favorite = {id, norad_id, sat_name, archived, created_at}`.
- Presets de avatar (deben coincidir con el backend): `earth, mars, jupiter, saturn, neptune, moon`. Se renderizan como círculos con gradiente CSS (no hay assets binarios). Un avatar subido llega como ruta `/media/<archivo>` y se muestra con `<img>`.
- Test runner en ESTE entorno (`npx ng test`/`ng build` fallan por Node 24.14.0 < gate 24.15.0 del CLI): usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`.
- Tests estilo repo: `describe/it/expect` + `TestBed`, HTTP con `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController`.

---

## File Structure

- `src/app/favorites/favorites.service.ts` — CRUD de favoritos + tipo `Favorite`.
- `src/app/auth/auth.service.ts` (modificar) — agregar `updateProfile(patch)` y `uploadAvatar(file)`.
- `src/app/profile/avatar.ts` — componente de presentación `Avatar` (input `avatar`), círculo-planeta o `<img>`.
- `src/app/profile/avatar.css` — gradientes de los 6 planetas.
- `src/app/profile/profile.ts` + `profile.css` — página de perfil (edición + avatar picker + lista de favoritos).
- `src/app/app.routes.ts` (modificar) — ruta `/profile` protegida con `authGuard`.
- `src/app/app.html` (modificar) — re-agregar el link "Perfil" en la navbar cuando hay sesión.

---

## Task 1: FavoritesService

**Files:**
- Create: `src/app/favorites/favorites.service.ts`
- Test: `src/app/favorites/favorites.service.spec.ts`

**Interfaces:**
- Produces: `FavoritesService` con `list()`, `add(norad_id, sat_name)`, `setArchived(id, archived)`, `remove(id)`; tipo `Favorite = {id:number; norad_id:number; sat_name:string; archived:number; created_at:string}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/favorites/favorites.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FavoritesService } from './favorites.service';

const FAV = { id: 1, norad_id: 25544, sat_name: 'ISS (ZARYA)', archived: 0, created_at: 'now' };

describe('FavoritesService', () => {
  let svc: FavoritesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FavoritesService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(FavoritesService);
    http = TestBed.inject(HttpTestingController);
  });

  it('list hace GET /api/favorites', () => {
    let got: any;
    svc.list().subscribe((r) => (got = r));
    const req = http.expectOne('/api/favorites');
    expect(req.request.method).toBe('GET');
    req.flush([FAV]);
    expect(got).toEqual([FAV]);
  });

  it('add hace POST con norad_id y sat_name', () => {
    svc.add(25544, 'ISS (ZARYA)').subscribe();
    const req = http.expectOne('/api/favorites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ norad_id: 25544, sat_name: 'ISS (ZARYA)' });
    req.flush(FAV);
  });

  it('setArchived hace PATCH', () => {
    svc.setArchived(1, true).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ archived: true });
    req.flush({ ...FAV, archived: 1 });
  });

  it('remove hace DELETE', () => {
    svc.remove(1).subscribe();
    const req = http.expectOne('/api/favorites/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./favorites.service` no encontrado.

- [ ] **Step 3: Implementar favorites.service.ts**

Crear `src/app/favorites/favorites.service.ts`:
```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 4 tests de FavoritesService PASAN; el resto verde.

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/favorites/favorites.service.ts src/app/favorites/favorites.service.spec.ts
git commit -m "feat(front): FavoritesService (CRUD + archivar)"
```

---

## Task 2: Métodos de perfil en AuthService

**Files:**
- Modify: `src/app/auth/auth.service.ts`
- Modify: `src/app/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `User`, `_user` signal (ya existen).
- Produces:
  - `updateProfile(patch: Partial<Pick<User,'display_name'|'home_lat'|'home_lng'|'viz_mode'|'avatar'>>): Observable<User>` — `PATCH /api/me`, actualiza el signal `user`.
  - `uploadAvatar(file: File): Observable<User>` — `POST /api/avatar` con `FormData` (campo `file`); la respuesta es `{avatar, user}`, actualiza `user` con `res.user` y devuelve el user.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/app/auth/auth.service.spec.ts` un bloque nuevo (dentro del `describe('AuthService')` existente, o uno nuevo con su propio setup). Usar este describe independiente al final del archivo:
```ts
describe('AuthService perfil', () => {
  let svc: AuthService;
  let http: HttpTestingController;
  const USER = { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AuthService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('updateProfile hace PATCH /api/me y actualiza user', () => {
    svc.updateProfile({ display_name: 'Ana G' }).subscribe();
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ display_name: 'Ana G' });
    req.flush({ ...USER, display_name: 'Ana G' });
    expect(svc.user()?.display_name).toBe('Ana G');
  });

  it('uploadAvatar hace POST /api/avatar con FormData y actualiza user', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' });
    let got: any;
    svc.uploadAvatar(file).subscribe((u) => (got = u));
    const req = http.expectOne('/api/avatar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ avatar: '/media/x.png', user: { ...USER, avatar: '/media/x.png' } });
    expect(got.avatar).toBe('/media/x.png');
    expect(svc.user()?.avatar).toBe('/media/x.png');
  });

  afterEach(() => http.verify());
});
```
(Verificar que `HttpTestingController`, `provideHttpClient`, `provideHttpClientTesting`, `TestBed` ya estén importados arriba en el archivo; si no, agregarlos.)

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL (métodos `updateProfile`/`uploadAvatar` no existen).

- [ ] **Step 3: Implementar los métodos en auth.service.ts**

En `src/app/auth/auth.service.ts`, agregar dentro de la clase `AuthService` (después de `logout()`), y asegurar que `map` esté importado de `rxjs`:
```ts
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
```
(`tap` ya está importado; agregar `map` al import de `rxjs` si falta.)

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 2 nuevos tests PASAN; los previos de AuthService (login/logout/register/rehidratación) siguen verdes.

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/auth/auth.service.ts src/app/auth/auth.service.spec.ts
git commit -m "feat(front): updateProfile y uploadAvatar en AuthService"
```

---

## Task 3: Componente de presentación Avatar

**Files:**
- Create: `src/app/profile/avatar.ts`, `src/app/profile/avatar.css`
- Test: `src/app/profile/avatar.spec.ts`

**Interfaces:**
- Produces: `Avatar` (selector `app-avatar`) con `input` requerido `avatar: string`. Si empieza con `/media` → `<img [src]="avatar">`; si es `preset:<id>` → `<span class="planet planet-<id>">`. Exporta la lista `PRESETS = ['earth','mars','jupiter','saturn','neptune','moon']`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/profile/avatar.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
  });

  it('renderiza img para un avatar subido (/media)', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', '/media/x.png');
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/media/x.png');
  });

  it('renderiza un círculo-planeta para un preset', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', 'preset:mars');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.planet-mars')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./avatar` no encontrado.

- [ ] **Step 3: Implementar avatar.ts**

Crear `src/app/profile/avatar.ts`:
```ts
import { Component, computed, input } from '@angular/core';

export const PRESETS = ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'moon'] as const;

@Component({
  selector: 'app-avatar',
  imports: [],
  template: `
    @if (isUpload()) {
      <img [src]="avatar()" alt="avatar" class="av" />
    } @else {
      <span class="av planet planet-{{ presetId() }}"></span>
    }
  `,
  styleUrl: './avatar.css',
})
export class Avatar {
  readonly avatar = input.required<string>();
  readonly isUpload = computed(() => this.avatar().startsWith('/media'));
  readonly presetId = computed(() => this.avatar().replace('preset:', '') || 'earth');
}
```

- [ ] **Step 4: Crear los gradientes**

Crear `src/app/profile/avatar.css`:
```css
.av {
  display: inline-block;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #1e2636;
}
.planet { background: #333; }
.planet-earth { background: radial-gradient(circle at 35% 30%, #4fa3ff, #1b3a6b 70%, #0a1a33); }
.planet-mars { background: radial-gradient(circle at 35% 30%, #ff8a5b, #a83a1a 70%, #5c1e0e); }
.planet-jupiter { background: radial-gradient(circle at 35% 30%, #e8c39e, #b07b4a 60%, #7a4a2a); }
.planet-saturn { background: radial-gradient(circle at 35% 30%, #f0e2b0, #c9a24a 70%, #8a6a2a); }
.planet-neptune { background: radial-gradient(circle at 35% 30%, #6fb1ff, #2a4fb0 70%, #16265c); }
.planet-moon { background: radial-gradient(circle at 35% 30%, #e8e8e8, #9a9a9a 70%, #5a5a5a); }
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 2 tests de Avatar PASAN.

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add src/app/profile/avatar.ts src/app/profile/avatar.css src/app/profile/avatar.spec.ts
git commit -m "feat(front): componente Avatar (planeta CSS o imagen subida)"
```

---

## Task 4: Página de perfil + ruta + navbar

**Files:**
- Create: `src/app/profile/profile.ts`, `src/app/profile/profile.css`, `src/app/profile/profile.spec.ts`
- Modify: `src/app/app.routes.ts` (ruta `/profile` protegida)
- Modify: `src/app/app.html` (link "Perfil")

**Interfaces:**
- Consumes: `AuthService` (`user`, `updateProfile`, `uploadAvatar`), `FavoritesService`, `Avatar`, `PRESETS`, `authGuard`.
- Produces: `Profile` (selector `app-profile`), página con: edición de `display_name`/`home_lat`/`home_lng`, picker de avatar (presets + upload), y lista de favoritos (activos y archivados) con archivar/desarchivar/quitar.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/profile/profile.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Profile } from './profile';
import { AuthService } from '../auth/auth.service';

const USER = { id: 1, email: 'a@b.com', display_name: 'Ana', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' };

describe('Profile', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // simular sesión activa
    const auth = TestBed.inject(AuthService);
    (auth as any)._user.set(USER);
  });

  it('carga favoritos al iniciar y muestra el nombre', () => {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    http.expectOne('/api/favorites').flush([{ id: 1, norad_id: 25544, sat_name: 'ISS', archived: 0, created_at: 'now' }]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ISS');
  });

  afterEach(() => http.verify());
});
```
NOTA: el test accede a `(auth as any)._user` para simular sesión. Si `_user` es privado, exponer en `AuthService` un método `setUser(u: User | null)` público y usarlo acá (`auth.setUser(USER)`); en ese caso agregar `setUser` en la Task 2 o acá. Elegir una y ser consistente.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./profile` no encontrado.

- [ ] **Step 3: Implementar profile.ts**

Crear `src/app/profile/profile.ts`:
```ts
import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { FavoritesService, Favorite } from '../favorites/favorites.service';
import { Avatar, PRESETS } from './avatar';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, Avatar],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private fb = inject(FormBuilder);
  private favs = inject(FavoritesService);
  protected auth = inject(AuthService);

  readonly presets = PRESETS;
  readonly favorites = signal<Favorite[]>([]);
  readonly active = computed(() => this.favorites().filter((f) => !f.archived));
  readonly archived = computed(() => this.favorites().filter((f) => f.archived));
  readonly saved = signal(false);

  readonly form = this.fb.nonNullable.group({
    display_name: [this.auth.user()?.display_name ?? ''],
    home_lat: [this.auth.user()?.home_lat ?? (null as number | null)],
    home_lng: [this.auth.user()?.home_lng ?? (null as number | null)],
  });

  constructor() {
    this.reload();
  }

  reload() {
    this.favs.list().subscribe((f) => this.favorites.set(f));
  }

  saveProfile() {
    this.auth.updateProfile(this.form.getRawValue()).subscribe(() => {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 1500);
    });
  }

  pickPreset(id: string) {
    this.auth.updateProfile({ avatar: `preset:${id}` }).subscribe();
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.auth.uploadAvatar(file).subscribe();
  }

  toggleArchive(f: Favorite) {
    this.favs.setArchived(f.id, !f.archived).subscribe(() => this.reload());
  }

  removeFav(f: Favorite) {
    this.favs.remove(f.id).subscribe(() => this.reload());
  }
}
```

- [ ] **Step 4: Crear el template profile.html**

Crear `src/app/profile/profile.html`:
```html
<section class="profile">
  <h1>Perfil</h1>

  <div class="avatar-row">
    <app-avatar [avatar]="auth.user()?.avatar ?? 'preset:earth'" />
    <div class="picker">
      <span>Elegí un planeta:</span>
      <div class="planets">
        @for (p of presets; track p) {
          <button type="button" class="planet-btn" (click)="pickPreset(p)">
            <app-avatar [avatar]="'preset:' + p" />
          </button>
        }
      </div>
      <label class="upload">
        Subir imagen/gif
        <input type="file" accept="image/*" (change)="onFile($event)" hidden />
      </label>
    </div>
  </div>

  <form [formGroup]="form" (ngSubmit)="saveProfile()" class="edit">
    <label>Nombre <input formControlName="display_name" /></label>
    <label>Latitud de casa <input type="number" formControlName="home_lat" /></label>
    <label>Longitud de casa <input type="number" formControlName="home_lng" /></label>
    <button type="submit">Guardar</button>
    @if (saved()) { <span class="ok">✓ guardado</span> }
  </form>

  <h2>Favoritos · {{ active().length }}</h2>
  <ul class="favs">
    @for (f of active(); track f.id) {
      <li>
        <span>{{ f.sat_name }}</span>
        <span class="actions">
          <button (click)="toggleArchive(f)">Archivar</button>
          <button (click)="removeFav(f)">Quitar</button>
        </span>
      </li>
    } @empty {
      <li class="empty">Todavía no guardaste favoritos.</li>
    }
  </ul>

  @if (archived().length) {
    <h2>Archivados · {{ archived().length }}</h2>
    <ul class="favs archived">
      @for (f of archived(); track f.id) {
        <li>
          <span>{{ f.sat_name }}</span>
          <span class="actions">
            <button (click)="toggleArchive(f)">Desarchivar</button>
            <button (click)="removeFav(f)">Quitar</button>
          </span>
        </li>
      }
    </ul>
  }
</section>
```
NOTA: en `profile.ts` cambiar `templateUrl: './profile.html'` (ya está así). Crear el archivo html.

- [ ] **Step 5: Crear profile.css**

Crear `src/app/profile/profile.css`:
```css
.profile { max-width: 40rem; margin: 2rem auto; padding: 0 1.2rem; color: #e6f1ff; }
.profile h1 { font-size: 1.6rem; }
.avatar-row { display: flex; gap: 1.2rem; align-items: flex-start; margin: 1rem 0; }
.picker .planets { display: flex; gap: 0.5rem; margin: 0.5rem 0; flex-wrap: wrap; }
.planet-btn { background: none; border: 2px solid transparent; border-radius: 50%; padding: 0; cursor: pointer; }
.planet-btn:hover { border-color: #00e5ff; }
.upload { display: inline-block; color: #00e5ff; cursor: pointer; text-decoration: underline; }
.edit { display: flex; flex-direction: column; gap: 0.6rem; max-width: 20rem; }
.edit input { padding: 0.5rem; background: #060911; border: 1px solid #1e2636; border-radius: 8px; color: #e6f1ff; }
.edit button, .actions button { padding: 0.4rem 0.8rem; background: #00e5ff; color: #051018; border: none; border-radius: 6px; cursor: pointer; }
.ok { color: #39ff88; }
.favs { list-style: none; padding: 0; }
.favs li { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1e2636; }
.actions { display: flex; gap: 0.4rem; }
.actions button { background: #16233a; color: #9fb3c8; }
.archived { opacity: 0.6; }
.empty { color: #5b6b7f; }
```

- [ ] **Step 6: Ruta protegida + link en navbar**

En `src/app/app.routes.ts`, agregar (import del guard arriba: `import { authGuard } from './auth/auth.guard';`) antes del redirect `''`:
```ts
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./profile/profile').then((m) => m.Profile) },
```

En `src/app/app.html`, dentro del bloque `@if (auth.isLoggedIn())`, re-agregar el link de Perfil (antes del botón Salir):
```html
    <a routerLink="/profile" routerLinkActive="active">Perfil</a>
```

- [ ] **Step 7: Correr tests y build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: test de Profile PASA, suite completa verde, build sin errores.

- [ ] **Step 8: Commit**

```bash
cd "D:/satelites-app" && git add src/app/profile src/app/app.routes.ts src/app/app.html
git commit -m "feat(front): página de perfil con edición, avatar picker y favoritos"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (del spec):** FavoritesService CRUD+archivar ✓ (T1); updateProfile + uploadAvatar en AuthService ✓ (T2); Avatar (presets CSS + upload) ✓ (T3); página `/profile` protegida con edición de nombre/ubicación, avatar picker (planetas + subir imagen/gif) y lista de favoritos activos+archivados con archivar/quitar ✓ (T4). Link "Perfil" re-agregado en navbar (fue removido al cierre del Plan 2 por ser link muerto).
- **Fuera de este plan (planes siguientes):** botón ★ Favorito en el globo (agregar desde `/globe` — va en el plan de Wikipedia+notas o su propio paso), panel Wikipedia+notas, heatmap/hexbin + persistencia `viz_mode`, stats chart.js, pulido del globo, loading screens.
- **Decisión de diseño:** avatares preset como círculos con gradiente CSS (no hay fotos reales de planetas bundleadas); un avatar subido se muestra con `<img>` desde `/media`. El backend valida el preset y el upload (tipo/tamaño) — el front solo ofrece la UI.
- **Consistencia:** `Favorite`/`User` usados igual en service, AuthService y Profile. `PRESETS` compartido entre `Avatar` y `Profile`. Ruta `/profile` protegida con `authGuard` (que ahora sí queda ejercido en producción). Nota para el implementador: si el spec de Profile necesita setear el user, decidir entre `(auth as any)._user.set(...)` o exponer `AuthService.setUser()` — preferir un `setUser()` público limpio si hace falta en más de un lugar.
