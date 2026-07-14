# Fase 6 — Frontend heatmap/hexbin + persistencia viz_mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un toggle en el globo para ver los satélites como puntos, mapa de calor de densidad, o agregación hexagonal; y persistir esa preferencia en el perfil del usuario (`viz_mode`).

**Architecture:** Un signal `vizMode` en el `Globe` controla qué capa de globe.gl se muestra. Un método `changeViz(mode)` centraliza: setear el signal, aplicar la capa (guardado si el globo existe), y persistir vía `AuthService.updateProfile({viz_mode})` cuando hay sesión. En init, arranca del `user().viz_mode` guardado. Las capas usan la API real de three-globe (verificada).

**Tech Stack:** Angular 22 standalone, signals, globe.gl (three-globe), Vitest.

## Global Constraints

- Angular 22 standalone; no NgModules; signals.
- Modos: `'points' | 'heatmap' | 'hexbin'`. Default `'points'`; si hay sesión, arranca del `AuthService.user()?.viz_mode`.
- API de capas de globe.gl (verificada en `node_modules/three-globe/dist/three-globe.d.ts`):
  - Puntos (ya en uso): `pointsData(arr)`.
  - Heatmap: `heatmapsData([points])` (array de heatmaps; una sola = el array de puntos), `heatmapPointLat(fn)`, `heatmapPointLng(fn)`, `heatmapPointWeight(fn|const)`, `heatmapBandwidth(n)`, `heatmapColorFn(fn)` (opcional).
  - Hexbin: `hexBinPointsData(points)`, `hexBinPointLat(fn)`, `hexBinPointLng(fn)`, `hexBinResolution(n)`, `hexAltitude(fn)`, `hexTopColor(fn)`, `hexSideColor(fn)`.
- Cambiar de modo NO rompe la selección, overhead, pases ni el fallback existentes.
- Persistencia: al cambiar de modo con sesión → `PATCH /api/me {viz_mode}` (vía `AuthService.updateProfile`). Sin sesión, solo cambia local.
- Las capas de globe.gl requieren WebGL y NO se pueden unit-testear en jsdom; los tests cubren el signal `vizMode` y la persistencia (llamada a `updateProfile`). La capa visual se verifica con `ng build` + prueba manual. `applyViz()` debe guardarse con `if (!this.globe) return` para no romper en tests.
- Test runner (`npx ng test`/`ng build` fallan por Node 24.14.0 < gate 24.15.0): usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`.

---

## File Structure

- `src/app/globe/globe.ts` (modificar) — signal `vizMode`, config de capas en `initGlobe`, `applyViz()`, `changeViz(mode)`, arranque desde `user().viz_mode`, y `tick()` que alimenta la capa activa.
- `src/app/globe/globe.html` (modificar) — toggle de 3 botones en el HUD.
- `src/app/globe/globe.css` (modificar) — estilos del toggle.
- `src/app/globe/globe.spec.ts` (modificar) — tests de `changeViz` (persistencia con/sin sesión).

---

## Task 1: Toggle de visualización y capas en el Globe

**Files:**
- Modify: `src/app/globe/globe.ts`, `src/app/globe/globe.html`, `src/app/globe/globe.css`

**Interfaces:**
- Produces: `vizMode` (signal `'points'|'heatmap'|'hexbin'`), `changeViz(mode)` (setea signal + aplica capa; la persistencia se agrega en Task 2), `applyViz()` (privado, configura las capas de globe.gl según `vizMode`, guardado si `!this.globe`).

- [ ] **Step 1: Leer el estado actual del Globe**

Leer `src/app/globe/globe.ts` (métodos `initGlobe`, `tick`, `select`, `deselect`) y `globe.html` (el `<div class="hud">`). Identificar cómo se setean los puntos (`this.globe.pointsData(this.points)`).

- [ ] **Step 2: Agregar el signal y el tipo**

En `globe.ts`, junto a los otros signals:
```ts
export type VizMode = 'points' | 'heatmap' | 'hexbin';
```
(el `export` va arriba, fuera de la clase, junto a la definición del componente) y dentro de la clase:
```ts
  readonly vizMode = signal<VizMode>('points');
```

- [ ] **Step 3: Configurar las capas de heatmap/hexbin en initGlobe**

En `initGlobe()`, después de configurar los puntos y antes de `this.timer = setInterval(...)`, agregar la configuración estática de las capas (los accessors; los datos se setean en `applyViz`/`tick`):
```ts
    this.globe
      // heatmap (densidad)
      .heatmapPointLat((d: any) => d.lat)
      .heatmapPointLng((d: any) => d.lng)
      .heatmapPointWeight(1)
      .heatmapBandwidth(2.5)
      .heatmapBaseAltitude(0.005)
      // hexbin (agregación)
      .hexBinPointLat((d: any) => d.lat)
      .hexBinPointLng((d: any) => d.lng)
      .hexBinPointWeight(1)
      .hexBinResolution(3)
      .hexAltitude((d: any) => Math.min(0.1, d.sumWeight * 0.002))
      .hexTopColor(() => 'rgba(0, 229, 255, 0.9)')
      .hexSideColor(() => 'rgba(0, 229, 255, 0.35)');
```

- [ ] **Step 4: Implementar applyViz() y changeViz()**

En `globe.ts` agregar:
```ts
  // Aplica la capa activa según vizMode (guardado si el globo aún no existe: tests/jsdom).
  private applyViz() {
    if (!this.globe) return;
    const pts = this.points;
    const mode = this.vizMode();
    this.globe.pointsData(mode === 'points' ? pts : []);
    this.globe.heatmapsData(mode === 'heatmap' ? [pts] : []);
    this.globe.hexBinPointsData(mode === 'hexbin' ? pts : []);
  }

  changeViz(mode: VizMode) {
    this.vizMode.set(mode);
    this.applyViz();
    // (persistencia: se agrega en Task 2)
  }
```

- [ ] **Step 5: Alimentar la capa activa en tick()**

En `tick()`, donde hoy hace `this.globe.pointsData(this.points);`, reemplazar por una llamada a `applyViz()` para que se actualice la capa que esté activa:
```ts
    this.points = this.sats.positionsAt(this.tles, new Date());
    this.applyViz();
```
(Mantener el resto de `tick()` igual: la lógica de `selected()`/overhead no cambia.)

- [ ] **Step 6: Toggle en el HTML**

En `globe.html`, dentro del `<div class="hud">` (después del bloque de `loadState`/`locateMe`), agregar:
```html
    <div class="viz">
      <button [class.on]="vizMode() === 'points'" (click)="changeViz('points')">Puntos</button>
      <button [class.on]="vizMode() === 'heatmap'" (click)="changeViz('heatmap')">Calor</button>
      <button [class.on]="vizMode() === 'hexbin'" (click)="changeViz('hexbin')">Hexágonos</button>
    </div>
```

- [ ] **Step 7: Estilos del toggle**

En `globe.css`, agregar:
```css
.viz { display: flex; gap: 0.3rem; margin-top: 0.4rem; }
.viz button {
  background: #16233a; color: #9fb3c8; border: 1px solid #2a3a52;
  border-radius: 6px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.8rem;
}
.viz button.on { background: #00e5ff; color: #051018; border-color: #00e5ff; }
```

- [ ] **Step 8: Build y tests**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: la suite sigue verde (el spec del Globe crea el componente; `applyViz` guarda por `!this.globe`), build sin errores. Si `ng build` marca que algún método de capa no existe, verificar el nombre exacto contra `node_modules/three-globe/dist/three-globe.d.ts` y corregir.

- [ ] **Step 9: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe/globe.ts src/app/globe/globe.html src/app/globe/globe.css
git commit -m "feat(front): toggle de visualización puntos/heatmap/hexbin en el globo"
```

---

## Task 2: Persistir viz_mode en el perfil

**Files:**
- Modify: `src/app/globe/globe.ts`
- Modify: `src/app/globe/globe.spec.ts`

**Interfaces:**
- Consumes: `AuthService` (`user`, `isLoggedIn`, `updateProfile`).
- Produces: `changeViz(mode)` ahora persiste con sesión (`updateProfile({viz_mode})`); el globo arranca en el `viz_mode` del usuario.

- [ ] **Step 1: Escribir el test que falla**

En `src/app/globe/globe.spec.ts`, agregar (o crear un bloque que inyecte AuthService). El Globe ya se testea con `provideHttpClient`+`provideHttpClientTesting`; agregar:
```ts
import { HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';

describe('Globe viz persistence', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('con sesión, changeViz persiste viz_mode con PATCH /api/me', () => {
    const auth = TestBed.inject(AuthService);
    (auth as any)._user.set({ id: 1, email: 'a@b.com', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'points', avatar: 'preset:earth' });
    const fixture = TestBed.createComponent(Globe);
    const cmp = fixture.componentInstance;
    cmp.changeViz('heatmap');
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ viz_mode: 'heatmap' });
    req.flush({ id: 1, email: 'a@b.com', display_name: 'A', home_lat: null, home_lng: null, viz_mode: 'heatmap', avatar: 'preset:earth' });
    expect(cmp.vizMode()).toBe('heatmap');
  });

  it('sin sesión, changeViz no pega a /api/me', () => {
    const fixture = TestBed.createComponent(Globe);
    fixture.componentInstance.changeViz('hexbin');
    http.expectNone('/api/me');
    expect(fixture.componentInstance.vizMode()).toBe('hexbin');
  });

  afterEach(() => http.verify());
});
```
NOTA: si el `beforeEach` del describe existente del Globe ya cubre imports/providers, este bloque nuevo repite el setup para aislar. Ajustar los imports duplicados (`provideHttpClient`, etc.) según lo que ya haya en el archivo.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL — `changeViz` todavía no persiste (el `expectOne('/api/me')` no encuentra request).

- [ ] **Step 3: Inyectar AuthService y persistir**

En `globe.ts`:
- Agregar `private auth = inject(AuthService);` (import: `import { AuthService } from '../auth/auth.service';`).
- En `changeViz(mode)`, después de `this.applyViz();`, agregar:
```ts
    if (this.auth.isLoggedIn()) {
      this.auth.updateProfile({ viz_mode: mode }).subscribe();
    }
```

- [ ] **Step 4: Arrancar del viz_mode guardado**

En el `constructor` del Globe (o al inicio de `initGlobe`, antes del primer `applyViz`/`tick`), setear el modo inicial desde el usuario si hay sesión:
```ts
    const saved = this.auth.user()?.viz_mode as VizMode | undefined;
    if (saved === 'points' || saved === 'heatmap' || saved === 'hexbin') {
      this.vizMode.set(saved);
    }
```
Ubicarlo de forma que `initGlobe`/`applyViz` ya lea el `vizMode` correcto. (Si se hace en el constructor, corre antes del render; `applyViz` en `initGlobe`/`tick` tomará el valor.)

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: los 2 tests de persistencia PASAN; el resto verde.

- [ ] **Step 6: Build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe/globe.ts src/app/globe/globe.spec.ts
git commit -m "feat(front): persistir viz_mode en el perfil y arrancar del guardado"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (del spec):** mapa de calor de densidad + toggle puntos/heatmap/hexbin ✓ (T1); preferencia de visualización persistida por usuario y restaurada al entrar ✓ (T2). Se alimenta de las posiciones ya propagadas (sin datos nuevos).
- **Fuera de este plan:** stats chart.js, pulido del globo, loading screens.
- **API verificada:** los métodos de capa (`heatmapsData`, `heatmapPointLat/Lng/Weight`, `heatmapBandwidth`, `hexBinPointsData`, `hexBinPointLat/Lng/Weight`, `hexBinResolution`, `hexAltitude`, `hexTopColor`, `hexSideColor`) existen en `three-globe` (base de globe.gl 2.46.1) — confirmado en su `.d.ts`.
- **Limitación de testeo:** las capas WebGL no corren en jsdom; `applyViz()` se guarda con `if (!this.globe) return`, y los tests cubren el signal + la persistencia (`updateProfile`). Lo visual se valida con build + prueba manual. Documentado.
- **Consistencia:** reusa `AuthService.updateProfile` (mismo contrato del backend, que valida `viz_mode ∈ {points,heatmap,hexbin}`). `heatmapsData` recibe un array de heatmaps: se pasa `[pts]` (un heatmap) o `[]` para apagarlo.
