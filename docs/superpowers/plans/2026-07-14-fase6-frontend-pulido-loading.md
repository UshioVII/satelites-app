# Fase 6 — Frontend pulido del globo + loading screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir el visualizador (sacar duplicados, sin parpadeo, movimiento continuo con satélite seleccionado, no rotar durante "¿Qué tengo sobre mí?", relieve del globo) y sumar pantallas de carga presentables (globo y home).

**Architecture:** Cambios acotados en el componente `Globe` (dedup en la carga, control central de auto-rotación, movimiento continuo en `tick()`, desactivar transición de puntos), config visual en `initGlobe` (bump map de relieve), animaciones CSS del panel/overhead, y overlays de carga. La lógica dedupeable se extrae a un helper puro testeable; el resto (WebGL/CSS) se valida con build + prueba manual.

**Tech Stack:** Angular 22 standalone, signals, globe.gl, Vitest.

## Global Constraints

- Angular 22 standalone; no NgModules; signals.
- NO romper la lógica existente (selección, overhead, pases, fallback TLE, viz toggle/persistencia).
- Las capas WebGL de globe.gl no corren en jsdom; los tests cubren el helper de dedup y el estado. Lo visual (relieve, animaciones, no-flicker, movimiento) se valida con `ng build` + prueba manual. Documentar.
- Test runner (`npx ng test`/`ng build` fallan por Node 24.14.0 < gate 24.15.0): usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`.

---

## File Structure

- `src/app/globe/globe.util.ts` (nuevo) — `dedupeSats(sats)` puro.
- `src/app/globe/globe.util.spec.ts` (nuevo) — test del dedup.
- `src/app/globe/globe.ts` (modificar) — usar dedup; auto-rotación central; movimiento continuo; sin transición de puntos.
- `src/app/globe/globe.html` (modificar) — overlay de carga.
- `src/app/globe/globe.css` (modificar) — animaciones panel/overhead + overlay/spinner.
- `src/app/pages/home.ts` (modificar) — pequeño estado de entrada/animación.

---

## Task 1: Dedup + movimiento continuo + auto-rotación + sin parpadeo

**Files:**
- Create: `src/app/globe/globe.util.ts`, `src/app/globe/globe.util.spec.ts`
- Modify: `src/app/globe/globe.ts`

**Interfaces:**
- Produces: `dedupeSats(sats: {name: string; satrec: {satnum: string|number}}[]): Sat[]` — quita satélites con `satrec.satnum` repetido (conserva el primero).

- [ ] **Step 1: Escribir el test que falla (dedup)**

Crear `src/app/globe/globe.util.spec.ts`:
```ts
import { dedupeSats } from './globe.util';

describe('dedupeSats', () => {
  it('quita satélites con el mismo satnum, conservando el primero', () => {
    const sats = [
      { name: 'ISS', satrec: { satnum: '25544' } },
      { name: 'HUBBLE', satrec: { satnum: '20580' } },
      { name: 'ISS DUP', satrec: { satnum: '25544' } },
    ] as any;
    const r = dedupeSats(sats);
    expect(r.length).toBe(2);
    expect(r.map((s: any) => s.name)).toEqual(['ISS', 'HUBBLE']);
  });

  it('lista vacía o sin duplicados pasa igual', () => {
    expect(dedupeSats([] as any)).toEqual([]);
    const two = [{ name: 'A', satrec: { satnum: 1 } }, { name: 'B', satrec: { satnum: 2 } }] as any;
    expect(dedupeSats(two).length).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false`
Expected: FAIL con módulo `./globe.util` no encontrado.

- [ ] **Step 3: Implementar globe.util.ts**

Crear `src/app/globe/globe.util.ts`:
```ts
import { Sat } from '../satellites.service';

// La fuente TLE a veces trae el mismo satélite repetido. Deduplicamos por NORAD id
// (satrec.satnum), conservando la primera aparición.
export function dedupeSats(sats: Sat[]): Sat[] {
  const seen = new Set<string>();
  const out: Sat[] = [];
  for (const s of sats) {
    const id = String(s.satrec.satnum);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out;
}
```

- [ ] **Step 4: Usar dedup en la carga**

En `src/app/globe/globe.ts`:
- Import: `import { dedupeSats } from './globe.util';`
- En `loadSatellites()`, en el `next`, cambiar `this.tles = sats;` por:
```ts
        this.tles = dedupeSats(sats);
        this.count.set(this.tles.length);
```
(y quitar el `this.count.set(sats.length);` viejo que quede duplicado).

- [ ] **Step 5: Movimiento continuo con satélite seleccionado**

En `tick()`, reemplazar el bloque actual:
```ts
    if (this.observer()) this.updateOverhead();
    if (this.selected()) return; // congelado si hay un satelite seleccionado
    this.points = this.sats.positionsAt(this.tles, new Date());
    this.applyViz();
```
por:
```ts
    if (this.observer()) this.updateOverhead();
    this.points = this.sats.positionsAt(this.tles, new Date());
    this.applyViz();
    // El seleccionado y el resto siguen moviéndose: refrescamos su posición/telemetría en vivo.
    const sel = this.selected();
    if (sel) {
      const fresh = this.points.find((p) => p.name === sel.name);
      if (fresh) this.selected.set(fresh);
    }
```
(Así los puntos se repropagan siempre; el highlight del seleccionado y su telemetría se actualizan cada segundo.)

- [ ] **Step 6: Auto-rotación central (no rotar durante overhead ni selección)**

En `globe.ts`, agregar un helper:
```ts
  // El globo rota solo cuando no hay selección ni ubicación fijada (para leer quieto).
  private updateAutoRotate() {
    if (!this.globe) return;
    this.globe.controls().autoRotate = !this.selected() && !this.observer();
  }
```
Reemplazar los seteos directos de `autoRotate`:
- En `initGlobe()`, dejar `this.globe.controls().autoRotateSpeed = 0.5;` y en lugar de setear `autoRotate = true` directo, llamar `this.updateAutoRotate();` (después de configurar controls).
- En `select()`: cambiar `this.globe.controls().autoRotate = false;` por `this.updateAutoRotate();` (después de setear `this.selected`).
- En `deselect()`: cambiar `this.globe.controls().autoRotate = true;` por `this.updateAutoRotate();` (después de limpiar `this.selected`).
- En `locateMe()`, en el callback de éxito (después de `this.observer.set(o)`), agregar `this.updateAutoRotate();`.

- [ ] **Step 7: Sin parpadeo de puntos**

En `initGlobe()`, en la cadena de configuración de puntos (junto a `.pointAltitude`/`.pointRadius`), agregar:
```ts
      .pointsTransitionDuration(0)
```
(globe.gl anima la transición de puntos al cambiar los datos; como cada tick genera objetos nuevos, esa animación reinicia y produce el parpadeo. Con duración 0 la actualización es instantánea. Verificar el nombre exacto contra `node_modules/three-globe/dist/three-globe.d.ts` si el build lo rechaza.)

- [ ] **Step 8: Correr tests y build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: dedup tests verdes + suite completa verde; build sin errores. Si `pointsTransitionDuration` no existe con ese nombre, corregir según el `.d.ts` de three-globe.

- [ ] **Step 9: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe/globe.util.ts src/app/globe/globe.util.spec.ts src/app/globe/globe.ts
git commit -m "feat(front): pulido del globo (dedup, movimiento continuo, auto-rotación, sin parpadeo)"
```

---

## Task 2: Relieve del globo + animaciones + pantallas de carga

**Files:**
- Modify: `src/app/globe/globe.ts` (bump map), `src/app/globe/globe.html` (overlay), `src/app/globe/globe.css` (animaciones + spinner), `src/app/pages/home.ts` (entrada)

**Interfaces:**
- Sin API nueva; cambios visuales.

- [ ] **Step 1: Relieve (bump map) para un globo más detallado**

En `src/app/globe/globe.ts`, en `initGlobe()`, en la cadena inicial junto a `.globeImageUrl(...)` y `.backgroundImageUrl(...)`, agregar:
```ts
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
```
(agrega relieve/topografía al globo — más detalle visual sin un asset pesado propio).

- [ ] **Step 2: Overlay de carga del globo**

En `src/app/globe/globe.html`, al principio del `<div class="wrap">` (o donde esté el contenedor del globo), agregar un overlay que se muestra mientras cargan los TLEs:
```html
  @if (loadState() === 'loading') {
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Cargando satélites…</p>
    </div>
  }
```
(Mantener el resto del HUD como está; este overlay es la pantalla de carga presentable.)

- [ ] **Step 3: Animaciones + spinner en globe.css**

En `src/app/globe/globe.css`, agregar:
```css
/* Pantalla de carga */
.loading-overlay {
  position: absolute; inset: 0; z-index: 5;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.8rem; background: rgba(6, 9, 17, 0.85); color: #9fb3c8;
}
.spinner {
  width: 2.5rem; height: 2.5rem; border-radius: 50%;
  border: 3px solid #1e2636; border-top-color: #00e5ff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Animación de aparición del panel de selección y del overhead */
.panel, .overhead {
  animation: fade-in 0.25s ease-out;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```
NOTA: verificar en `globe.html` los nombres reales de las clases del panel de selección y del bloque de overhead; ajustar los selectores (`.panel`, `.overhead`) a los que existan en el template. Si el panel usa otra clase (p. ej. `aside`/`.selected`), aplicar la animación a esa.

- [ ] **Step 4: Estado de entrada del Home**

En `src/app/pages/home.ts`, agregar una animación de entrada al `.hero` (aparición suave al cargar la página). En el bloque `styles`, agregar:
```css
    .hero { animation: hero-in 0.4s ease-out; }
    @keyframes hero-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
```
(pequeña pantalla/animación de entrada para el home; sin lógica nueva).

- [ ] **Step 5: Build y tests**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: suite completa verde (sin cambios de lógica que rompan tests), build sin errores.

- [ ] **Step 6: Commit**

```bash
cd "D:/satelites-app" && git add src/app/globe/globe.ts src/app/globe/globe.html src/app/globe/globe.css src/app/pages/home.ts
git commit -m "feat(front): relieve del globo, animaciones y pantallas de carga"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura (sticky note / spec):** bug de duplicados ✓ (T1, dedup por satnum); movimiento continuo con selección ✓ (T1, tick repropaga + refresca seleccionado); no rotar durante "¿Qué tengo sobre mí?" ✓ (T1, autoRotate central off con observer); sin parpadeo ✓ (T1, pointsTransitionDuration 0); recorrido fluido → cubierto por el movimiento continuo (la órbita ya se dibuja); globo de mayor calidad ✓ (T2, bump map de relieve); animaciones del panel/overhead ✓ (T2); pantallas de carga (globo overlay + home entrada) ✓ (T2).
- **Fuera de alcance:** nada más del spec queda pendiente tras este plan (es el último subsistema del frontend).
- **Testeo:** dedup en helper puro testeado; el resto (WebGL/CSS) se valida con build + manual. Documentado.
- **Riesgos/notas:** verificar el nombre exacto `pointsTransitionDuration` y `bumpImageUrl` contra el `.d.ts` de three-globe si el build los rechaza (ambos son de la API de three-globe/globe.gl). Ajustar los selectores CSS de animación a las clases reales del template del globo.
