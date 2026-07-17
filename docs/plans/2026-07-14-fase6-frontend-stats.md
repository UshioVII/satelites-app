# Fase 6 — Frontend dashboard de stats (chart.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página `/stats` protegida con un mini-dashboard (chart.js): satélites sobre tu ubicación ahora (por rango de elevación) y próximos pases de un satélite (elevación máxima por pase).

**Architecture:** La lógica de datos (bucketing por elevación, mapear pases a serie de gráfico) vive en helpers puros y testeables (`stats.util.ts`). El componente `Stats` carga TLEs con `SatellitesService`, obtiene el observador (ubicación de casa del perfil o geolocalización), calcula las series con los helpers y las dibuja con chart.js. El render de chart.js (canvas 2d) no corre en jsdom, así que se guarda; los tests cubren los helpers + la carga.

**Tech Stack:** Angular 22 standalone, signals, chart.js (nueva dependencia), Vitest.

## Global Constraints

- Angular 22 standalone; no NgModules; signals.
- `chart.js` se instala como dependencia. Import: `import Chart from 'chart.js/auto';` (auto-registra todos los controllers).
- `/stats` protegida por `authGuard`, lazy-loaded. Re-agregar el link "Stats" en la navbar (fue removido al cierre del Plan 2).
- Datos desde `SatellitesService` (ya existe): `loadTLEs('visual')` → `{sats, live}`; `overhead(tles, lat, lng, date)` → `OverheadSat[]` (`{name, elevation, azimuth, rangeKm}`); `nextPasses(sat, lat, lng, date)` → `Pass[]` (`{start, peak, end, maxElevation, startAz, endAz, durationMin}`). `Sat = {name, satrec}`.
- Observador: usar `AuthService.user()?.home_lat/home_lng` si están; si no, botón "usar mi ubicación" (geolocalización del navegador). Sin observador, invitar a definir ubicación (no romper).
- chart.js necesita canvas 2d; en jsdom `canvas.getContext('2d')` devuelve null → el componente debe guardar la creación del chart (`if (!ctx) return;`). Los tests cubren `stats.util.ts` + que el componente cargue TLEs y muestre el prompt sin ubicación. Lo visual se valida con build + prueba manual.
- Test runner (`npx ng test`/`ng build` fallan por Node 24.14.0 < gate 24.15.0): usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`.

---

## File Structure

- `src/app/stats/stats.util.ts` — helpers puros: `bucketByElevation(sats)`, `passesToSeries(passes)`.
- `src/app/stats/stats.ts` + `stats.css` — página `Stats` (`app-stats`), carga + charts.
- `src/app/app.routes.ts` (modificar) — ruta `/stats` protegida, lazy.
- `src/app/app.html` (modificar) — link "Stats" en la navbar.
- `package.json` — dependencia `chart.js`.

---

## Task 1: Instalar chart.js + helpers de datos

**Files:**
- Modify: `package.json` (+ `chart.js`)
- Create: `src/app/stats/stats.util.ts`
- Test: `src/app/stats/stats.util.spec.ts`

**Interfaces:**
- Produces:
  - `bucketByElevation(sats: { elevation: number }[]): { label: string; count: number }[]` — 3 buckets: `'0–30°'`, `'30–60°'`, `'60–90°'` (elevación en grados; ≥0). Siempre devuelve los 3 buckets (count 0 si vacío).
  - `passesToSeries(passes: { start: Date; maxElevation: number }[]): { labels: string[]; data: number[] }` — `labels` = hora `HH:MM` de cada pase, `data` = `maxElevation` redondeado.

- [ ] **Step 1: Instalar chart.js**

Run: `cd "D:/satelites-app" && npm install chart.js`
Expected: se agrega a `dependencies` sin errores.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/app/stats/stats.util.spec.ts`:
```ts
import { bucketByElevation, passesToSeries } from './stats.util';

describe('stats.util', () => {
  it('bucketByElevation agrupa por rango y siempre da 3 buckets', () => {
    const r = bucketByElevation([{ elevation: 10 }, { elevation: 25 }, { elevation: 45 }, { elevation: 80 }]);
    expect(r.map((b) => b.count)).toEqual([2, 1, 1]); // 0-30: 10,25 | 30-60: 45 | 60-90: 80
    expect(r.map((b) => b.label)).toEqual(['0–30°', '30–60°', '60–90°']);
  });

  it('bucketByElevation con lista vacía da los 3 buckets en 0', () => {
    expect(bucketByElevation([]).map((b) => b.count)).toEqual([0, 0, 0]);
  });

  it('passesToSeries mapea a horas y elevación máxima redondeada', () => {
    const s = passesToSeries([
      { start: new Date('2026-07-14T20:05:00'), maxElevation: 42.7 },
      { start: new Date('2026-07-14T21:30:00'), maxElevation: 10.2 },
    ]);
    expect(s.data).toEqual([43, 10]);
    expect(s.labels.length).toBe(2);
    expect(s.labels[0]).toMatch(/20:05/);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./stats.util` no encontrado.

- [ ] **Step 4: Implementar stats.util.ts**

Crear `src/app/stats/stats.util.ts`:
```ts
// Agrupa satélites por rango de elevación (0–30, 30–60, 60–90 grados). Siempre 3 buckets.
export function bucketByElevation(sats: { elevation: number }[]): { label: string; count: number }[] {
  const buckets = [
    { label: '0–30°', count: 0 },
    { label: '30–60°', count: 0 },
    { label: '60–90°', count: 0 },
  ];
  for (const s of sats) {
    const i = s.elevation < 30 ? 0 : s.elevation < 60 ? 1 : 2;
    buckets[i].count++;
  }
  return buckets;
}

// Convierte una lista de pases en series para el gráfico: hora del pase + elevación máxima.
export function passesToSeries(passes: { start: Date; maxElevation: number }[]): { labels: string[]; data: number[] } {
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    labels: passes.map((p) => hhmm(p.start)),
    data: passes.map((p) => Math.round(p.maxElevation)),
  };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 3 tests de stats.util PASAN.

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add package.json package-lock.json src/app/stats/stats.util.ts src/app/stats/stats.util.spec.ts
git commit -m "feat(front): chart.js + helpers de stats (buckets de elevación, serie de pases)"
```

---

## Task 2: Página /stats con los gráficos

**Files:**
- Create: `src/app/stats/stats.ts`, `src/app/stats/stats.css`, `src/app/stats/stats.spec.ts`
- Modify: `src/app/app.routes.ts`, `src/app/app.html`

**Interfaces:**
- Consumes: `SatellitesService`, `AuthService`, `bucketByElevation`, `passesToSeries`, `authGuard`, `Chart` (chart.js).
- Produces: `Stats` (`app-stats`), página que carga TLEs, obtiene observador (perfil o geolocalización), calcula y dibuja 2 gráficos; muestra prompt de ubicación si no hay observador.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/stats/stats.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Stats } from './stats';

describe('Stats', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Stats],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('carga TLEs y, sin ubicación, muestra el prompt', () => {
    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
    // el componente pide los TLEs al iniciar (via SatellitesService.loadTLEs -> /celestrak)
    const req = http.expectOne((r) => r.url.includes('/celestrak'));
    req.flush('ISS (ZARYA)\n1 25544U 98067A   24....\n2 25544  51.6....');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ubicación');
  });

  afterEach(() => http.verify());
});
```
NOTA: el TLE del test es ilustrativo; `satellite.js` puede fallar al parsear un TLE inválido. Si el parse rompe el test, usar un TLE real de la ISS (2 líneas válidas) o mockear `SatellitesService.loadTLEs` con un `of({sats: [], live: true})` provider. Elegir lo que mantenga el test estable y verde; el objetivo del test es: (a) se piden los TLEs, (b) sin observador aparece el prompt de ubicación.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./stats` no encontrado.

- [ ] **Step 3: Implementar stats.ts**

Crear `src/app/stats/stats.ts`:
```ts
import { Component, ElementRef, afterNextRender, inject, signal, viewChild, OnDestroy } from '@angular/core';
import Chart from 'chart.js/auto';
import { SatellitesService, Sat } from '../satellites.service';
import { AuthService } from '../auth/auth.service';
import { bucketByElevation, passesToSeries } from './stats.util';

@Component({
  selector: 'app-stats',
  imports: [],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnDestroy {
  private sats = inject(SatellitesService);
  private auth = inject(AuthService);
  private overheadCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overheadChart');
  private passesCanvas = viewChild<ElementRef<HTMLCanvasElement>>('passesChart');

  readonly observer = signal<{ lat: number; lng: number } | null>(null);
  readonly geoError = signal('');
  private tles: Sat[] = [];
  private charts: Chart[] = [];

  constructor() {
    const u = this.auth.user();
    if (u?.home_lat != null && u?.home_lng != null) this.observer.set({ lat: u.home_lat, lng: u.home_lng });
    this.sats.loadTLEs('visual').subscribe(({ sats }) => {
      this.tles = sats;
      afterNextRender(() => this.render());
      this.render();
    });
  }

  locateMe() {
    if (!navigator.geolocation) { this.geoError.set('Sin geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { this.observer.set({ lat: p.coords.latitude, lng: p.coords.longitude }); this.render(); },
      (e) => this.geoError.set('No pudimos obtener tu ubicación: ' + e.message),
    );
  }

  private render() {
    const o = this.observer();
    if (!o || !this.tles.length) return;
    const now = new Date();
    // Gráfico 1: satélites encima ahora por elevación
    const buckets = bucketByElevation(this.sats.overhead(this.tles, o.lat, o.lng, now));
    this.draw(this.overheadCanvas(), 'bar', buckets.map((b) => b.label), buckets.map((b) => b.count), 'Satélites encima');
    // Gráfico 2: próximos pases de la ISS (o el primer satélite)
    const iss = this.tles.find((s) => s.name.includes('ISS')) ?? this.tles[0];
    if (iss) {
      const series = passesToSeries(this.sats.nextPasses(iss, o.lat, o.lng, now));
      this.draw(this.passesCanvas(), 'bar', series.labels, series.data, `Pases de ${iss.name} (elev. máx °)`);
    }
  }

  // Crea/reemplaza un chart en el canvas. Guarda si no hay contexto 2d (jsdom).
  private draw(ref: ElementRef<HTMLCanvasElement> | undefined, type: 'bar', labels: string[], data: number[], label: string) {
    const ctx = ref?.nativeElement?.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type,
      data: { labels, datasets: [{ label, data, backgroundColor: 'rgba(0,229,255,0.6)' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#c8d6e5' } } }, scales: { x: { ticks: { color: '#9fb3c8' } }, y: { ticks: { color: '#9fb3c8' }, beginAtZero: true } } },
    }));
  }

  ngOnDestroy() {
    this.charts.forEach((c) => c.destroy());
  }
}
```

- [ ] **Step 4: Crear stats.html**

Crear `src/app/stats/stats.html`:
```html
<section class="stats">
  <h1>Estadísticas</h1>
  @if (!observer()) {
    <p class="muted">Definí tu ubicación para ver satélites cercanos y próximos pases.</p>
    <button (click)="locateMe()">📍 Usar mi ubicación</button>
    @if (geoError()) { <p class="err">{{ geoError() }}</p> }
  }
  <div class="chart"><canvas #overheadChart></canvas></div>
  <div class="chart"><canvas #passesChart></canvas></div>
</section>
```

- [ ] **Step 5: Crear stats.css**

Crear `src/app/stats/stats.css`:
```css
.stats { max-width: 42rem; margin: 2rem auto; padding: 0 1.2rem; color: #e6f1ff; }
.stats h1 { font-size: 1.6rem; }
.muted { color: #9fb3c8; }
.err { color: #ff6b6b; }
.chart { background: #0b0f1a; border: 1px solid #1e2636; border-radius: 12px; padding: 1rem; margin: 1rem 0; }
.stats button { padding: 0.5rem 0.9rem; background: #00e5ff; color: #051018; border: none; border-radius: 8px; cursor: pointer; }
```

- [ ] **Step 6: Ruta protegida + link navbar**

En `src/app/app.routes.ts`, agregar (junto a la ruta `profile`):
```ts
  { path: 'stats', canActivate: [authGuard], loadComponent: () => import('./stats/stats').then((m) => m.Stats) },
```
En `src/app/app.html`, dentro del `@if (auth.isLoggedIn())`, junto al link de Perfil:
```html
    <a routerLink="/stats" routerLinkActive="active">Stats</a>
```

- [ ] **Step 7: Tests y build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: el test de Stats PASA (carga TLEs + prompt de ubicación), suite completa verde, build sin errores. Si el spec rompe por el parseo del TLE ilustrativo, aplicar la NOTA del Step 1 (TLE real o mock de `loadTLEs`).

- [ ] **Step 8: Commit**

```bash
cd "D:/satelites-app" && git add src/app/stats/stats.ts src/app/stats/stats.html src/app/stats/stats.css src/app/stats/stats.spec.ts src/app/app.routes.ts src/app/app.html
git commit -m "feat(front): dashboard /stats con chart.js (encima ahora + próximos pases)"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (del spec):** mini-dashboard con chart.js: satélites encima ahora por elevación ✓ y próximos pases (elevación máx por pase) ✓ (las dos, T2). Requiere ubicación (perfil o geolocalización); sin ella, prompt ✓.
- **Fuera de este plan:** pulido del globo, loading screens.
- **Decisiones:** lógica de datos en helpers puros testeables (`stats.util.ts`); el render de chart.js se guarda por `getContext('2d')` null (jsdom) — se valida con build + manual. Reusa `SatellitesService.overhead/nextPasses`. El 2do gráfico usa la ISS (o el primer TLE) por simplicidad; se puede extender a elegir un favorito más adelante.
- **Consistencia:** `/stats` protegida con `authGuard` (igual que `/profile`), link re-agregado en navbar. `Pass`/`OverheadSat` ya definidos en `SatellitesService`.
- **Nota para el implementador:** chart.js dibuja en canvas 2d; jsdom no lo soporta, por eso el guard. Mantener el test de Stats enfocado en carga + prompt (no en el chart). Si el TLE ilustrativo rompe el parseo de satellite.js, usar un TLE real de la ISS o mockear `loadTLEs`.
