# Fase 6 — Frontend Wikipedia + notas + favorito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al seleccionar un satélite en el globo, mostrar un panel de info tipo enciclopedia (resumen + imagen de Wikipedia, con fallback), notas personales del usuario, y un botón ★ Favorito.

**Architecture:** Un `WikiService` (consulta la API REST de Wikipedia, cachea en memoria) y un `NotesService` (CRUD `/api/notes/:norad_id`). Un componente `SatInfo` (`app-sat-info`, inputs `name` y `noradId`) que encapsula Wikipedia + notas + favorito, para que el `Globe` cambie lo mínimo. El `Globe` solo pasa el nombre y el NORAD id del satélite seleccionado.

**Tech Stack:** Angular 22 standalone, signals, HttpClient, Vitest.

## Global Constraints

- Angular 22 standalone; no NgModules; `signal()`/`computed()`/`effect()`/`input()`/`inject()`.
- Wikipedia: `GET https://en.wikipedia.org/api/rest_v1/page/summary/<title>` (su API REST permite CORS). Respuesta con `extract` y opcional `thumbnail.source`. En 404/error → `null` (fallback). Se usa `en.wikipedia` por mejor cobertura de satélites; el nombre del TLE se limpia (quitar paréntesis, ej. `ISS (ZARYA)` → `ISS`).
- Notas (backend, proxy `/api`): `GET /api/notes/:norad_id` → `{norad_id, body, updated_at}` o 404; `PUT /api/notes/:norad_id {body}` → nota; `DELETE /api/notes/:norad_id` → 204. Requieren sesión (el interceptor agrega el token).
- Favorito: usa `FavoritesService.add(norad_id, sat_name)` (ya existe); 409 si ya está.
- El NORAD id de un satélite sale de `satrec.satnum` (satellite.js) — ya disponible en el `Globe` para el satélite seleccionado.
- Notas y favorito solo se ofrecen con sesión (`AuthService.isLoggedIn()`); sin sesión, invitar a loguearse. Wikipedia se muestra siempre.
- Test runner (`npx ng test`/`ng build` fallan por Node 24.14.0 < gate 24.15.0): usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`.
- Tests estilo repo: `describe/it/expect` + `TestBed`, HTTP con `provideHttpClient()`+`provideHttpClientTesting()`+`HttpTestingController`.

---

## File Structure

- `src/app/sat/wiki.service.ts` — consulta Wikipedia, cachea por título limpio.
- `src/app/sat/notes.service.ts` — CRUD de la nota por `norad_id`.
- `src/app/sat/sat-info.ts` + `sat-info.css` — panel `app-sat-info` (Wikipedia + notas + favorito).
- `src/app/globe/globe.ts` (modificar) — exponer `selectedNorad` y renderizar `<app-sat-info>`.
- `src/app/globe/globe.html` (modificar) — insertar el panel cuando hay selección.

---

## Task 1: WikiService

**Files:**
- Create: `src/app/sat/wiki.service.ts`
- Test: `src/app/sat/wiki.service.spec.ts`

**Interfaces:**
- Produces: `WikiService.summary(name: string): Observable<WikiSummary | null>` donde `WikiSummary = {title: string; extract: string; thumbnail: string | null; url: string}`. Limpia el nombre y cachea por título limpio (misma consulta no re-pega).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/sat/wiki.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { WikiService } from './wiki.service';

describe('WikiService', () => {
  let svc: WikiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WikiService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(WikiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('limpia el nombre (quita paréntesis) y pega a Wikipedia', () => {
    let got: any;
    svc.summary('ISS (ZARYA)').subscribe((r) => (got = r));
    const req = http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/ISS');
    req.flush({ title: 'ISS', extract: 'La ISS...', thumbnail: { source: 'http://img/x.jpg' }, content_urls: { desktop: { page: 'http://wiki/ISS' } } });
    expect(got.extract).toBe('La ISS...');
    expect(got.thumbnail).toBe('http://img/x.jpg');
  });

  it('devuelve null si no hay página (404)', () => {
    let got: any = 'x';
    svc.summary('Basura123').subscribe((r) => (got = r));
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Basura123').flush(null, { status: 404, statusText: 'Not Found' });
    expect(got).toBeNull();
  });

  it('cachea: la segunda llamada no pega de nuevo', () => {
    svc.summary('Hubble').subscribe();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble').flush({ title: 'Hubble', extract: 'x', thumbnail: null, content_urls: { desktop: { page: 'u' } } });
    svc.summary('Hubble').subscribe();
    http.expectNone('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble');
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./wiki.service` no encontrado.

- [ ] **Step 3: Implementar wiki.service.ts**

Crear `src/app/sat/wiki.service.ts`:
```ts
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
```
NOTA: `encodeURIComponent('ISS')` = `'ISS'`, así que el test que espera `.../summary/ISS` pasa. Para nombres con espacios el encode los convierte (Wikipedia acepta `%20`/`_`); no afecta a los tests dados.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 3 tests de WikiService PASAN.

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/sat/wiki.service.ts src/app/sat/wiki.service.spec.ts
git commit -m "feat(front): WikiService (resumen + imagen, cacheado)"
```

---

## Task 2: NotesService

**Files:**
- Create: `src/app/sat/notes.service.ts`
- Test: `src/app/sat/notes.service.spec.ts`

**Interfaces:**
- Produces: `NotesService` con `get(noradId): Observable<Note | null>` (404 → null), `save(noradId, body): Observable<Note>` (PUT), `remove(noradId): Observable<void>` (DELETE). `Note = {norad_id:number; body:string; updated_at:string}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/sat/notes.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let svc: NotesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotesService, provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(NotesService);
    http = TestBed.inject(HttpTestingController);
  });

  it('get devuelve la nota', () => {
    let got: any;
    svc.get(25544).subscribe((r) => (got = r));
    http.expectOne('/api/notes/25544').flush({ norad_id: 25544, body: 'la vi', updated_at: 'now' });
    expect(got.body).toBe('la vi');
  });

  it('get devuelve null en 404', () => {
    let got: any = 'x';
    svc.get(25544).subscribe((r) => (got = r));
    http.expectOne('/api/notes/25544').flush(null, { status: 404, statusText: 'Not Found' });
    expect(got).toBeNull();
  });

  it('save hace PUT con body', () => {
    svc.save(25544, 'hola').subscribe();
    const req = http.expectOne('/api/notes/25544');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ body: 'hola' });
    req.flush({ norad_id: 25544, body: 'hola', updated_at: 'now' });
  });

  it('remove hace DELETE', () => {
    svc.remove(25544).subscribe();
    const req = http.expectOne('/api/notes/25544');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./notes.service` no encontrado.

- [ ] **Step 3: Implementar notes.service.ts**

Crear `src/app/sat/notes.service.ts`:
```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 4 tests de NotesService PASAN.

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/sat/notes.service.ts src/app/sat/notes.service.spec.ts
git commit -m "feat(front): NotesService (CRUD de nota por norad_id)"
```

---

## Task 3: Componente SatInfo (Wikipedia + notas + favorito)

**Files:**
- Create: `src/app/sat/sat-info.ts`, `src/app/sat/sat-info.css`
- Test: `src/app/sat/sat-info.spec.ts`

**Interfaces:**
- Consumes: `WikiService`, `NotesService`, `FavoritesService`, `AuthService`.
- Produces: `SatInfo` (`app-sat-info`) con inputs requeridos `name: string` y `noradId: number`. Muestra: Wikipedia (extract + img o fallback), botón ★ Favorito (solo con sesión), y editor de notas (solo con sesión). Reacciona a cambios de input.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/sat/sat-info.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SatInfo } from './sat-info';

describe('SatInfo', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SatInfo],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('muestra el resumen de Wikipedia', () => {
    const fixture = TestBed.createComponent(SatInfo);
    fixture.componentRef.setInput('name', 'Hubble');
    fixture.componentRef.setInput('noradId', 20580);
    fixture.detectChanges();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Hubble')
      .flush({ title: 'Hubble', extract: 'Telescopio espacial', thumbnail: null, content_urls: { desktop: { page: 'u' } } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Telescopio espacial');
    // sin sesión: no hay editor de notas ni pega a /api/notes
    http.expectNone('/api/notes/20580');
  });

  it('muestra fallback cuando no hay página de Wikipedia', () => {
    const fixture = TestBed.createComponent(SatInfo);
    fixture.componentRef.setInput('name', 'Basura');
    fixture.componentRef.setInput('noradId', 1);
    fixture.detectChanges();
    http.expectOne('https://en.wikipedia.org/api/rest_v1/page/summary/Basura').flush(null, { status: 404, statusText: 'NF' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin datos de Wikipedia');
  });

  afterEach(() => http.verify());
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./sat-info` no encontrado.

- [ ] **Step 3: Implementar sat-info.ts**

Crear `src/app/sat/sat-info.ts`:
```ts
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WikiService, WikiSummary } from './wiki.service';
import { NotesService } from './notes.service';
import { FavoritesService } from '../favorites/favorites.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-sat-info',
  imports: [FormsModule],
  templateUrl: './sat-info.html',
  styleUrl: './sat-info.css',
})
export class SatInfo {
  private wiki = inject(WikiService);
  private notesApi = inject(NotesService);
  private favs = inject(FavoritesService);
  protected auth = inject(AuthService);

  readonly name = input.required<string>();
  readonly noradId = input.required<number>();

  readonly wikiState = signal<'loading' | 'ok' | 'none'>('loading');
  readonly summary = signal<WikiSummary | null>(null);
  readonly note = signal('');
  readonly favMsg = signal('');

  constructor() {
    // Wikipedia: refetch cuando cambia el nombre.
    effect(() => {
      const n = this.name();
      this.wikiState.set('loading');
      this.summary.set(null);
      this.wiki.summary(n).subscribe((s) => {
        this.summary.set(s);
        this.wikiState.set(s ? 'ok' : 'none');
      });
    });
    // Notas: cargar la nota del usuario cuando cambia el satélite (solo con sesión).
    effect(() => {
      const id = this.noradId();
      this.note.set('');
      this.favMsg.set('');
      if (this.auth.isLoggedIn()) {
        this.notesApi.get(id).subscribe((nt) => this.note.set(nt?.body ?? ''));
      }
    });
  }

  saveNote() {
    this.notesApi.save(this.noradId(), this.note()).subscribe();
  }

  addFavorite() {
    this.favs.add(this.noradId(), this.name()).subscribe({
      next: () => this.favMsg.set('★ Guardado'),
      error: (e) => this.favMsg.set(e?.status === 409 ? 'Ya en favoritos' : 'No se pudo guardar'),
    });
  }
}
```

- [ ] **Step 4: Crear el template sat-info.html**

Crear `src/app/sat/sat-info.html`:
```html
<div class="sat-info">
  @switch (wikiState()) {
    @case ('loading') { <p class="muted">Buscando info…</p> }
    @case ('ok') {
      <div class="wiki">
        @if (summary()!.thumbnail) { <img [src]="summary()!.thumbnail" alt="foto" class="thumb" /> }
        <p class="extract">{{ summary()!.extract }}</p>
        @if (summary()!.url) { <a [href]="summary()!.url" target="_blank" rel="noopener">Wikipedia ↗</a> }
      </div>
    }
    @case ('none') {
      <p class="muted">🛰️ Sin datos de Wikipedia para este objeto.</p>
    }
  }

  @if (auth.isLoggedIn()) {
    <button class="fav" (click)="addFavorite()">★ Favorito</button>
    @if (favMsg()) { <span class="favmsg">{{ favMsg() }}</span> }

    <div class="notes">
      <label>Mis notas</label>
      <textarea [(ngModel)]="noteModel" rows="3" placeholder="Anotá algo sobre este satélite…"></textarea>
      <button (click)="saveNote()">Guardar nota</button>
    </div>
  } @else {
    <p class="muted">Iniciá sesión para guardar favoritos y notas.</p>
  }
</div>
```
NOTA: `[(ngModel)]` necesita un bindeo a una propiedad. Como `note` es un signal, usar `[ngModel]="note()" (ngModelChange)="note.set($event)"` en vez de `[(ngModel)]="noteModel"`. Ajustar el textarea a:
```html
<textarea [ngModel]="note()" (ngModelChange)="note.set($event)" rows="3" placeholder="Anotá algo sobre este satélite…"></textarea>
```

- [ ] **Step 5: Crear sat-info.css**

Crear `src/app/sat/sat-info.css`:
```css
.sat-info { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.wiki { display: flex; flex-direction: column; gap: 0.4rem; }
.thumb { width: 100%; max-height: 8rem; object-fit: cover; border-radius: 8px; }
.extract { font-size: 0.85rem; line-height: 1.4; color: #c8d6e5; margin: 0; }
.muted { color: #5b6b7f; font-size: 0.85rem; }
.wiki a, .favmsg { color: #00e5ff; font-size: 0.8rem; }
.fav { background: #16233a; color: #ffd166; border: 1px solid #2a3a52; border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; }
.notes { display: flex; flex-direction: column; gap: 0.3rem; }
.notes label { font-size: 0.8rem; color: #9fb3c8; }
.notes textarea { background: #060911; border: 1px solid #1e2636; border-radius: 8px; color: #e6f1ff; padding: 0.4rem; resize: vertical; }
.notes button, .fav { align-self: flex-start; }
.notes button { background: #00e5ff; color: #051018; border: none; border-radius: 6px; padding: 0.3rem 0.7rem; cursor: pointer; }
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 2 tests de SatInfo PASAN (Wikipedia ok y fallback). Sin sesión no pega a `/api/notes`.

- [ ] **Step 7: Commit**

```bash
cd "D:/satelites-app" && git add src/app/sat/sat-info.ts src/app/sat/sat-info.html src/app/sat/sat-info.css src/app/sat/sat-info.spec.ts
git commit -m "feat(front): panel SatInfo (Wikipedia + notas + favorito)"
```

---

## Task 4: Integrar SatInfo en el Globe

**Files:**
- Modify: `src/app/globe/globe.ts` (exponer NORAD id del seleccionado, importar SatInfo)
- Modify: `src/app/globe/globe.html` (renderizar `<app-sat-info>` en el panel de selección)

**Interfaces:**
- Consumes: `SatInfo`, el satélite seleccionado del `Globe`.
- Produces: cuando hay un satélite seleccionado, el panel muestra `<app-sat-info [name]="selected()!.name" [noradId]="selectedNorad()!">`.

- [ ] **Step 1: Leer el estado actual del Globe**

Leer `src/app/globe/globe.ts` y `src/app/globe/globe.html`. Identificar:
- el signal `selected` (satélite seleccionado, tipo `PosSat | null`),
- el método `select(d: PosSat)` donde se busca el `Sat` (que tiene `satrec`),
- dónde se muestra el panel de telemetría del seleccionado en el HTML (el bloque `@if (selected())`).

- [ ] **Step 2: Exponer el NORAD id del seleccionado**

En `src/app/globe/globe.ts`:
- Agregar el import: `import { SatInfo } from '../sat/sat-info';` y sumarlo al array `imports` del `@Component`.
- Agregar un signal `readonly selectedNorad = signal<number | null>(null);` junto a los otros signals.
- En `select(d: PosSat)`, después de encontrar `const sat = this.tles.find((s) => s.name === d.name);`, setear:
  ```ts
  this.selectedNorad.set(sat ? Number(sat.satrec.satnum) : null);
  ```
- En `deselect()`, agregar `this.selectedNorad.set(null);`.

(Si `satrec.satnum` es string, `Number(...)` lo convierte; satellite.js expone `satnum` como el NORAD catalog number.)

- [ ] **Step 3: Renderizar el panel en el HTML**

En `src/app/globe/globe.html`, dentro del bloque que muestra los datos del satélite seleccionado (`@if (selected())`), agregar al final del panel:
```html
    @if (selectedNorad()) {
      <app-sat-info [name]="selected()!.name" [noradId]="selectedNorad()!" />
    }
```
(Ubicarlo dentro del contenedor del panel de selección existente, después de la telemetría.)

- [ ] **Step 4: Correr tests y build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: toda la suite verde (el spec del Globe sigue creando el componente ok; SatInfo no se instancia sin selección), build sin errores. Si el spec del Globe falla por el nuevo import, verificar que `SatInfo` esté en `imports` y que su árbol de providers (HttpClient) ya esté disponible en el test del Globe (usa `provideHttpClientTesting`).

- [ ] **Step 5: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe/globe.ts src/app/globe/globe.html
git commit -m "feat(front): panel de info del satélite en el globo"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (del spec):** Wikipedia (resumen + imagen, fallback a "sin datos") ✓ (T1, T3); notas personales por satélite (cargar/guardar, solo con sesión) ✓ (T2, T3); botón ★ Favorito en el globo (con sesión) ✓ (T3, integrado T4). Panel integrado al seleccionar un satélite ✓ (T4).
- **Fuera de este plan:** heatmap/hexbin + persistencia `viz_mode`, stats chart.js, pulido del globo, loading screens.
- **Decisiones:** `en.wikipedia` por cobertura de satélites (el extract puede venir en inglés; aceptable para learning). Cache en memoria por título limpio (evita re-pegar). El panel `SatInfo` encapsula todo para minimizar cambios en `globe.ts`. NORAD id desde `satrec.satnum`.
- **Consistencia:** `SatInfo` consume servicios ya existentes (`FavoritesService`, `AuthService`) y los nuevos (`WikiService`, `NotesService`). `Note`/`WikiSummary` definidos en sus servicios. El botón favorito reusa `FavoritesService.add` (mismo contrato que el backend, 409 si ya existe).
- **Nota para el implementador:** el `[(ngModel)]` de dos vías sobre un signal no funciona directo; usar `[ngModel]="note()" (ngModelChange)="note.set($event)"` (indicado en la Task 3). Verificar que `FormsModule` esté en `imports` del componente.
