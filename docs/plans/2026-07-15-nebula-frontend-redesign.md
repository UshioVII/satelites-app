# Nebula — Rediseño visual del frontend · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el sistema de diseño "Nebula" (glass enterprise recto, gradiente cyan→violeta→índigo, glow, medidores RAG, gráficos estilo NASA, telemetría en mono) a todo el frontend de satelites-app, sin tocar lógica ni datos.

**Architecture:** Tokens y utilidades en el stylesheet global `src/styles.css`; dos componentes nuevos de presentación (`NebulaBackground`, `ProximityGauge`); restyle del `Window` existente; y aplicación de estilos/plantilla pantalla por pantalla (home, HUD del globo, ventanas Perfil/Stats) reusando datos que la app ya calcula. Los gráficos usan chart.js (ya instalado) y SVG.

**Tech Stack:** Angular 22 standalone, signals, globe.gl, chart.js, Vitest, CSS puro (sin librerías de UI ni webfonts externas).

## Global Constraints

- Angular 22 standalone; sin NgModules; signals. Seguir patrones existentes.
- **Solo presentación**: NO cambiar lógica, servicios, ni forma de datos. Los 47 tests de front y 28 de back deben seguir verdes tras cada fase.
- **Sin dependencias nuevas** ni CDN ni webfonts externas. Fuentes del sistema (`--sans`, `--mono`).
- Tema único oscuro (compromiso deliberado). No hay modo claro.
- `prefers-reduced-motion: reduce` desactiva animaciones no esenciales.
- Node 24.14.0 < gate 24.15.0: usar `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build` (NO `npx ng`).
- Fuente de verdad visual: spec `docs/superpowers/specs/2026-07-15-nebula-design-system.md` y la muestra "Nebula v0.4".
- Branch: `fase6-frontend`.
- **Verificación por tarea** (no hay TDD de CSS): tras implementar, correr tests + build (deben quedar verdes = sin regresión) y hacer verificación visual en `:4200` contra la muestra. Documentar.

---

## File Structure

- `src/styles.css` (modificar) — tokens Nebula + utilidades globales (`.glass`, `.btn`, `.seg`, texto-gradiente, glow). Hoy es el stylesheet global (confirmado en angular.json).
- `src/app/ui/nebula-background.ts` (nuevo) — starfield canvas + blobs de nebulosa. Standalone.
- `src/app/ui/proximity-gauge.ts` (nuevo) — medidor vertical RAG. Standalone, input `value` (0–90).
- `src/app/ui/window.ts` / `window.css` (modificar) — esquinas rectas + barra con gradiente.
- `src/app/pages/home.ts` (modificar) — hero Nebula + fondo.
- `src/app/globe/globe.html` / `globe.css` (modificar) — HUD, botones, panel "sobre vos ahora" con gauges.
- `src/app/sat/sat-info.html` / `sat-info.css` (modificar) — card premium + plot de pase (SVG).
- `src/app/stats/stats.ts` / `stats.css` (modificar) — stat tiles + chart.js re-tematizado + multi-serie.
- `src/app/profile/profile.css` (modificar) — Nebula en la ventana de perfil.

---

## Task 1: Tokens, utilidades globales, fondo Nebula y restyle de Window

**Files:**
- Modify: `src/styles.css`
- Create: `src/app/ui/nebula-background.ts`
- Modify: `src/app/ui/window.ts`, `src/app/ui/window.css`

**Interfaces:**
- Produces: variables CSS globales (`--bg`, `--cyan`, `--brand`, etc.) y clases `.glass`, `.btn`, `.btn.primary`, `.btn.ghost`, `.seg`, `.text-grad`, disponibles en toda la app.
- Produces: `<app-nebula-background />` — componente standalone `NebulaBackground` (selector `app-nebula-background`), fondo fijo z-index 0.

- [ ] **Step 1: Escribir los tokens y utilidades en `src/styles.css`**

Reemplazar/añadir al principio de `src/styles.css` (mantener resets existentes que hubiera debajo):

```css
:root {
  --bg: #060911; --bg-2: #0a0e1a;
  --surface: rgba(16,20,34,0.62); --surface-solid: #0d1120;
  --cyan: #00e5ff; --violet: #7c3aed; --indigo: #4f46e5;
  --brand: linear-gradient(100deg, #00e5ff 0%, #7c3aed 55%, #4f46e5 100%);
  --ink: #e9f2ff; --ink-2: #9fb3c8; --ink-3: #5b6b7f;
  --ok: #39ff88; --warn: #ffcf6b; --danger: #ff5b5b;
  --far: #ff2e2e; --near: #ffcc00; --close: #1fff87;
  --line: rgba(0,229,255,0.22); --line-violet: rgba(124,58,237,0.28);
  --glow-cyan: 0 0 0 1px rgba(0,229,255,0.25), 0 0 28px -6px rgba(0,229,255,0.55);
  --glow-violet: 0 0 34px -8px rgba(124,58,237,0.6);
  --radius: 4px; --radius-win: 2px;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
body { background: var(--bg); color: var(--ink); font-family: var(--sans); }

.glass { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 24px 60px -30px rgba(0,0,0,0.9); }
.text-grad { background: var(--brand); -webkit-background-clip: text; background-clip: text; color: transparent; }

.btn { font: 600 0.95rem/1 var(--sans); padding: 0.7rem 1.2rem; border-radius: 3px; cursor: pointer;
  border: none; position: relative; overflow: hidden; transition: transform .18s, box-shadow .25s; }
.btn:active { transform: translateY(1px); }
.btn.primary { color: #04121a; background: var(--brand); box-shadow: 0 0 0 1px rgba(0,229,255,0.4), 0 8px 30px -8px rgba(0,229,255,0.7); }
.btn.primary:hover { box-shadow: 0 0 0 1px rgba(0,229,255,0.6), 0 10px 40px -6px rgba(124,58,237,0.85); transform: translateY(-1px); }
.btn.primary::after { content:""; position:absolute; inset:0; background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.45) 50%, transparent 80%); transform: translateX(-120%); transition: transform .6s; }
.btn.primary:hover::after { transform: translateX(120%); }
.btn.ghost { color: var(--ink); background-image: linear-gradient(var(--surface-solid), var(--surface-solid)), var(--brand);
  background-origin: border-box; background-clip: padding-box, border-box; border: 1px solid transparent; }
.btn.ghost:hover { box-shadow: var(--glow-cyan); }

.seg { display: inline-flex; padding: 3px; border-radius: 3px; background: var(--surface-solid); border: 1px solid var(--line); gap: 3px; }
.seg button { font: 600 0.85rem var(--sans); padding: 0.45rem 0.9rem; border-radius: 2px; border: none; cursor: pointer; background: transparent; color: var(--ink-2); }
.seg button.on { color: #04121a; background: var(--brand); box-shadow: 0 0 18px -4px rgba(0,229,255,0.7); }

@media (prefers-reduced-motion: reduce) { .btn, .btn::after { transition: none !important; } }
```

- [ ] **Step 2: Crear `NebulaBackground`**

Crear `src/app/ui/nebula-background.ts`:

```ts
import { Component, ElementRef, OnDestroy, OnInit, viewChild } from '@angular/core';

// Fondo ambiente: starfield en canvas + blobs de nebulosa CSS a la deriva.
// Fijo detrás del contenido (z-index 0). Respeta prefers-reduced-motion.
@Component({
  selector: 'app-nebula-background',
  template: `
    <canvas #cv class="stars"></canvas>
    <div class="nebula" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 0; pointer-events: none; display: block; }
    .stars { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .nebula { position: absolute; inset: -20% -10% -10% -10%; filter: blur(60px); opacity: 0.5; }
    .nebula span { position: absolute; border-radius: 50%; mix-blend-mode: screen; animation: drift 26s ease-in-out infinite alternate; }
    .b1 { width: 46vw; height: 46vw; left: -6vw; top: -8vw; background: radial-gradient(circle, rgba(0,229,255,0.5), transparent 65%); }
    .b2 { width: 52vw; height: 52vw; right: -12vw; top: 8vh; background: radial-gradient(circle, rgba(124,58,237,0.55), transparent 62%); animation-delay: -8s; }
    .b3 { width: 40vw; height: 40vw; left: 22vw; bottom: -18vw; background: radial-gradient(circle, rgba(79,70,229,0.5), transparent 60%); animation-delay: -14s; }
    @keyframes drift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(4vw,-3vh,0) scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .nebula span { animation: none; } }
  `],
})
export class NebulaBackground implements OnInit, OnDestroy {
  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private raf = 0;
  private stars: { x: number; y: number; r: number; a: number; s: number; tw: number }[] = [];
  private w = 0; private h = 0; private dpr = Math.min(devicePixelRatio || 1, 2);
  private onResize = () => this.resize();

  ngOnInit() {
    this.resize();
    addEventListener('resize', this.onResize);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.frame();
    else this.draw(); // un frame estático
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); }

  private resize() {
    const c = this.cv().nativeElement;
    this.w = c.width = innerWidth * this.dpr; this.h = c.height = innerHeight * this.dpr;
    const n = Math.min(220, Math.floor((innerWidth * innerHeight) / 9000));
    this.stars = Array.from({ length: n }, () => ({
      x: Math.random() * this.w, y: Math.random() * this.h, r: (Math.random() * 1.3 + 0.2) * this.dpr,
      a: Math.random(), s: Math.random() * 0.02 + 0.004, tw: Math.random() < 0.5 ? 1 : -1,
    }));
  }
  private draw() {
    const x = this.cv().nativeElement.getContext('2d')!;
    x.clearRect(0, 0, this.w, this.h);
    for (const st of this.stars) {
      st.a += st.s * st.tw; if (st.a > 1 || st.a < 0.1) st.tw *= -1;
      x.beginPath(); x.arc(st.x, st.y, st.r, 0, 7);
      x.fillStyle = (st.r > 1.6 * this.dpr ? 'rgba(170,150,255,' : 'rgba(220,240,255,') + st.a + ')';
      x.fill();
    }
  }
  private frame = () => { this.draw(); this.raf = requestAnimationFrame(this.frame); };
}
```

- [ ] **Step 3: Restyle del `Window` a recto + barra con gradiente**

En `src/app/ui/window.css`, cambiar `.win` y `.bar`:
```css
.win { border-radius: 2px; overflow: hidden; border: 1px solid var(--line);
  background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 24px 60px -30px rgba(0,0,0,0.9); }
.bar { background: linear-gradient(100deg, rgba(0,229,255,0.16), rgba(124,58,237,0.16)); }
.title { color: var(--cyan); }
```
(mantener el resto de `window.css`; solo ajustar radius a 2px y la barra al gradiente).

- [ ] **Step 4: Verificar tests + build (no regresión)**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 tests verdes; build sin errores. (Ningún test cubre CSS; el objetivo es que los tokens/utilidades no rompan nada existente.)

- [ ] **Step 5: Verificación visual + commit**

Verificar en `:4200` que la app sigue andando con los nuevos tokens (colores base, ventanas rectas). Luego:
```bash
cd "D:/satelites-app" && git add src/styles.css src/app/ui/nebula-background.ts src/app/ui/window.ts src/app/ui/window.css
git commit -m "feat(front): Nebula fase 1 — tokens, utilidades, fondo y window recto"
```

---

## Task 2: Home Nebula

**Files:**
- Modify: `src/app/pages/home.ts`

**Interfaces:**
- Consumes: tokens/utilidades globales y `<app-nebula-background />` de Task 1.

- [ ] **Step 1: Añadir el fondo y aplicar estilos Nebula al home**

En `src/app/pages/home.ts`: importar `NebulaBackground`, agregarlo a `imports`, montarlo al inicio del template, y reestilar el hero. Template:
```html
<app-nebula-background />
<section class="hero">
  <span class="eyebrow">Tiempo real · TLE de CelesTrak</span>
  <h1>🛰️ <span class="text-grad">Satélites</span></h1>
  <p class="lead">Visualizador 3D de satélites en tiempo real. Seguí la Estación Espacial y cientos de objetos en órbita, mirá qué tenés sobre tu cabeza ahora mismo y predecí sus próximos pases.</p>
  <ul class="feats">
    <li>Globo 3D en vivo con datos TLE reales (CelesTrak)</li>
    <li>Elegí un satélite y vé su órbita, telemetría e info de Wikipedia</li>
    <li>Guardá favoritos y notas, con tu perfil y estadísticas</li>
  </ul>
  <div class="cta">
    <a class="btn primary" routerLink="/globe">Ver el globo</a>
    @if (auth.isLoggedIn()) {
      <button class="btn ghost" (click)="win.openProfile()">Mi perfil</button>
    } @else {
      <a class="btn ghost" routerLink="/login">Entrar</a>
    }
  </div>
  <p class="stack">Angular 22 · globe.gl · satellite.js · Node/Express + SQLite</p>
</section>
```
Reemplazar el bloque `styles` por:
```css
.hero { position: relative; z-index: 1; max-width: 48rem; margin: 12vh auto; padding: 0 1.4rem; color: var(--ink);
  animation: hero-in .5s cubic-bezier(.2,.7,.2,1) both; }
@keyframes hero-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.eyebrow { font-family: var(--mono); font-size: .72rem; letter-spacing: .24em; text-transform: uppercase; color: var(--cyan); }
.hero h1 { font-size: clamp(2.6rem, 7vw, 4.4rem); line-height: 1.02; letter-spacing: -.03em; margin: .5rem 0 0; font-weight: 800; }
.lead { color: var(--ink-2); font-size: 1.12rem; line-height: 1.6; max-width: 44ch; margin-top: 1.1rem; }
.feats { color: #c8d6e5; line-height: 1.9; margin: 1.2rem 0; }
.cta { display: flex; gap: .8rem; margin: 1.4rem 0; flex-wrap: wrap; }
.stack { color: var(--ink-3); font-size: .85rem; font-family: var(--mono); }
@media (prefers-reduced-motion: reduce) { .hero { animation: none; } }
```
Asegurar que la clase del componente tenga `readonly win = inject(WindowsService)` (ya está) y el import de `NebulaBackground`.

- [ ] **Step 2: Verificar tests + build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 verdes; build OK.

- [ ] **Step 3: Verificación visual + commit**

En `:4200/` verificar el home contra la muestra (fondo nebulosa, título en gradiente, CTAs con glow). Commit:
```bash
cd "D:/satelites-app" && git add src/app/pages/home.ts
git commit -m "feat(front): Nebula fase 2 — home con hero, fondo y CTAs"
```

---

## Task 3: HUD del globo + medidor RAG vertical

**Files:**
- Create: `src/app/ui/proximity-gauge.ts`
- Modify: `src/app/globe/globe.html`, `src/app/globe/globe.css`

**Interfaces:**
- Produces: `<app-proximity-gauge [value]="n" [label]="s" />` — `ProximityGauge` (selector `app-proximity-gauge`), input `value: number` (0–90, elevación), input `label: string`.

- [ ] **Step 1: Crear `ProximityGauge`**

Crear `src/app/ui/proximity-gauge.ts`:
```ts
import { Component, computed, input } from '@angular/core';

// Medidor vertical: verde arriba (alto/cerca), amarillo medio, rojo abajo (bajo/lejos).
// La marca indica el valor actual (elevación 0–90°).
@Component({
  selector: 'app-proximity-gauge',
  template: `
    <div class="gauge">
      <div class="scale">
        <div class="zone green"></div><div class="zone yellow"></div><div class="zone red"></div>
        <div class="marker" [style.bottom.%]="pct()"></div>
      </div>
      <div class="gval">{{ value() | number: '1.0-0' }}°</div>
      @if (label()) { <div class="glabel">{{ label() }}</div> }
    </div>
  `,
  styles: [`
    .gauge { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
    .scale { position: relative; width: 26px; height: 96px; border: 2px solid rgba(233,242,255,0.85);
      box-shadow: 0 0 14px -4px rgba(0,229,255,0.5); display: flex; flex-direction: column; }
    .zone { flex: 1; } .zone.green { background: var(--close); } .zone.yellow { background: var(--near); } .zone.red { background: var(--far); }
    .marker { position: absolute; left: -4px; right: -4px; height: 3px; background: #fff; box-shadow: 0 0 8px #fff; }
    .marker::after { content: ""; position: absolute; right: -8px; top: -3px; border: 4px solid transparent; border-right-color: #fff; }
    .gval { font-family: var(--mono); font-weight: 700; font-variant-numeric: tabular-nums; font-size: .85rem; }
    .glabel { font-family: var(--mono); font-size: .68rem; color: var(--ink-3); max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
  imports: [],
})
export class ProximityGauge {
  readonly value = input.required<number>();
  readonly label = input('');
  readonly pct = computed(() => Math.max(0, Math.min(100, (this.value() / 90) * 100)));
}
```
Nota: agregar `DecimalPipe` a `imports` del componente para el pipe `number`. Import: `import { DecimalPipe } from '@angular/common';` y `imports: [DecimalPipe]`.

- [ ] **Step 2: Usar los gauges en el panel "sobre vos ahora" y reestilar el HUD**

En `src/app/globe/globe.ts`: importar `ProximityGauge`, agregarlo a `imports` del componente `Globe`.

En `src/app/globe/globe.html`, dentro de `<section class="overhead">`, reemplazar la lista `<ul>...</ul>` por una fila de gauges (usa `s.elevation` que ya existe en `OverheadSat`):
```html
<div class="gauge-row">
  @for (s of overhead().slice(0, 6); track s.name) {
    <app-proximity-gauge [value]="s.elevation" [label]="s.name" />
  } @empty {
    <p class="muted">Nada sobre el horizonte ahora mismo.</p>
  }
</div>
```

En `src/app/globe/globe.css`, aplicar Nebula al HUD y paneles (reemplazar los backgrounds/colores actuales por tokens; sumar borde-gradiente y glow). Cambios clave:
```css
.hud, .overhead, .panel { background: var(--surface); border: 1px solid var(--line);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: var(--radius); box-shadow: var(--glow-cyan); }
.panel h2, .overhead h3, .passes h3 { color: var(--cyan); }
.gauge-row { display: flex; gap: .9rem; flex-wrap: wrap; }
.viz { /* mantener; el look segmentado ya viene de la clase global .seg si se aplica, o dejar el actual */ }
.loc-btn { background: rgba(0,229,255,0.1); color: var(--cyan); border: 1px solid var(--line); border-radius: 3px; }
.loc-btn:hover { box-shadow: var(--glow-cyan); }
```
(Ajustar selectores a los reales del template; el objetivo es: HUD/paneles glass rectos, acentos cyan, botones con glow. No tocar la lógica.)

- [ ] **Step 3: Verificar tests + build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 verdes (el gauge no corre WebGL; su lógica `pct` es pura). Build OK. Si querés, sumar un test chico de `ProximityGauge` que verifique `pct` (0°→0, 90°→100, 45°→50).

- [ ] **Step 4: Verificación visual + commit**

En `:4200/globe`, con "¿Qué tengo sobre mí?" activo, verificar los gauges y el HUD glass. Commit:
```bash
cd "D:/satelites-app" && git add src/app/ui/proximity-gauge.ts src/app/globe/globe.ts src/app/globe/globe.html src/app/globe/globe.css
git commit -m "feat(front): Nebula fase 3 — HUD glass y medidores RAG en overhead"
```

---

## Task 4: Gráficos estilo NASA (perfil de pase + multi-serie de favoritos)

**Files:**
- Modify: `src/app/sat/sat-info.html`, `src/app/sat/sat-info.css` (perfil de pase)
- Modify: `src/app/stats/stats.ts`, `src/app/stats/stats.css` (multi-serie + re-tema chart.js)

**Interfaces:**
- Consumes: `passes()` en `SatInfo`/`Globe` (ya existe: `Pass[]` con `maxElevation`, `start`), y los favoritos+TLEs en Stats.

- [ ] **Step 1: Perfil de pase (SVG) en el panel de pases**

Antes de tocar código, leer `sat-info.html` y `globe.html` para ver dónde se listan los pases (`passes()`), y `satellites.service.ts` para el tipo `Pass` (campos disponibles: `start`, `maxElevation`, `startAz`, `endAz`, `durationMin`).

Agregar, junto a la lista de próximos pases, un mini-SVG por pase (o uno para el próximo) que dibuje una curva de campana de elevación con bandas RAG de fondo, grilla y ejes en mono. Como los `Pass` no traen la serie temporal completa, dibujar una campana normalizada a `maxElevation` (altura del pico = maxElevation/90). Marca visual, no recomputo de órbita. Estructura SVG (viewBox `0 0 320 120`), con bandas RAG (verde alto, amarillo medio, rojo bajo), grilla tenue, y `path` de la campana con glow cyan. Estilos en `sat-info.css`:
```css
.pass-plot svg { display: block; width: 100%; height: auto; }
.pass-plot .yt, .pass-plot .xt { font-family: var(--mono); font-size: 8px; fill: var(--ink-3); }
```
(La curva exacta puede ser una campana fija escalada por `maxElevation`; el objetivo es la lectura "estilo NASA", no precisión sub-grado. Documentar esta simplificación con un comentario en el template.)

- [ ] **Step 2: Re-tematizar chart.js y sumar el multi-serie de favoritos en Stats**

Leer `stats.ts` para ver la config actual de chart.js (datasets, options). Aplicar el tema Nebula a las options comunes (ejes/grid/labels):
```ts
// tema Nebula para chart.js
const nebula = {
  grid:   { color: 'rgba(159,179,200,0.16)' },
  ticks:  { color: '#9fb3c8', font: { family: 'ui-monospace, SF Mono, monospace', size: 10 } },
};
// en options.scales.x/​y usar: grid: nebula.grid, ticks: nebula.ticks
// líneas/puntos: borderColor por serie, tension 0.3, pointRadius 3
```
Agregar un chart de líneas multi-serie "Comparar favoritos" (altitud de cada favorito en el tiempo), **una serie por favorito con `f.color`** (viene de `FavoritesService.items()`), alimentado propagando cada favorito con `SatellitesService.positionsAt` en N instantes (reusar el patrón de `profile.ts` que ya carga TLEs y propaga favoritos). Leyenda visible abajo. Dataset:
```ts
datasets: activeFavs.map(f => ({
  label: f.sat_name,
  data: samples.map(t => altKmDe(f, t)),
  borderColor: f.color ?? '#00e5ff',
  backgroundColor: 'transparent',
  tension: 0.3, pointRadius: 3,
}))
```
Estilar el contenedor y stat tiles en `stats.css` con tokens (números con `.text-grad`, mono en labels).

- [ ] **Step 3: Verificar tests + build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 verdes; build OK. Si algún test de stats asume la config vieja del chart, ajustarlo sin cambiar la lógica testeada.

- [ ] **Step 4: Verificación visual + commit**

En `:4200`: abrir la ventana Stats (multi-serie con colores de favoritos) y seleccionar un satélite con pases (perfil NASA). Commit:
```bash
cd "D:/satelites-app" && git add src/app/sat/sat-info.html src/app/sat/sat-info.css src/app/stats/stats.ts src/app/stats/stats.css
git commit -m "feat(front): Nebula fase 4 — gráficos NASA (pase + multi-serie favoritos)"
```

---

## Task 5: Ventanas Perfil y Stats + stat tiles

**Files:**
- Modify: `src/app/profile/profile.css`, `src/app/stats/stats.css`

**Interfaces:**
- Consumes: tokens/utilidades de Task 1; el contenido de perfil/stats ya vive dentro de `Window` (Task 1 lo dejó recto).

- [ ] **Step 1: Aplicar Nebula al contenido del Perfil**

En `src/app/profile/profile.css`: superficies glass/tokens, headers de sección en cyan, filas de favorito con el chip de color ya existente pero con glow (`box-shadow: 0 0 10px -1px currentColor`), telemetría en `--mono`, avatar con anillo gradiente:
```css
.profile h1, .profile h2 { color: var(--cyan); }
.avatar-row app-avatar .av { border: 2px solid transparent; background-image: linear-gradient(var(--bg), var(--bg)), var(--brand); background-origin: border-box; background-clip: padding-box, border-box; border-radius: 50%; }
.fav-color { box-shadow: 0 0 8px -1px currentColor; }
.fav-info { font-family: var(--mono); color: var(--ink-2); }
.edit input { background: var(--surface-solid); border: 1px solid var(--line); color: var(--ink); border-radius: 3px; }
.edit button { border-radius: 3px; }
```
(Ajustar a los selectores reales de `profile.html`; no cambiar lógica.)

- [ ] **Step 2: Stat tiles en Stats**

En `src/app/stats/stats.css`: tiles glass rectos, número grande con `.text-grad` (o clase local equivalente) y `font-variant-numeric: tabular-nums`, labels en mono uppercase:
```css
.stat-tile { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; }
.stat-tile .k { font-family: var(--mono); font-size: .72rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); }
.stat-tile .v { font-size: 2.6rem; font-weight: 800; letter-spacing: -.02em; background: var(--brand); -webkit-background-clip: text; background-clip: text; color: transparent; font-variant-numeric: tabular-nums; }
```
(Ajustar a las clases reales de `stats.html`.)

- [ ] **Step 3: Verificar tests + build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 verdes; build OK.

- [ ] **Step 4: Verificación visual + commit**

En `:4200`: abrir las ventanas Perfil y Stats y verificar contra la muestra. Commit:
```bash
cd "D:/satelites-app" && git add src/app/profile/profile.css src/app/stats/stats.css
git commit -m "feat(front): Nebula fase 5 — ventanas Perfil y Stats + stat tiles"
```

---

## Task 6: Pase final — consistencia, reduced-motion, accesibilidad

**Files:**
- Modify: los que hagan falta según la revisión (login/register `pages/*`, `sat-info.css`, etc.)

- [ ] **Step 1: Barrido de consistencia**

Recorrer login, register y cualquier superficie no tocada (`pages/login.ts`, `pages/register.ts`, `auth-form.css`) y aplicar tokens/utilidades (`.glass`, `.btn`, inputs con `--surface-solid`/`--line`, radius 3px). Objetivo: nada quedó con el estilo viejo.

- [ ] **Step 2: reduced-motion y accesibilidad**

Verificar que todas las animaciones nuevas tengan fallback `@media (prefers-reduced-motion: reduce)`. Chequear foco visible en botones/links (`:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }` global en `styles.css`), contraste del texto sobre glass, y `aria-label` en los SVG de gráficos.

- [ ] **Step 3: Verificar tests + build**

Run: `cd "D:/satelites-app" && node node_modules/@angular/cli/bin/bootstrap.js test --watch=false && node node_modules/@angular/cli/bin/bootstrap.js build`
Expected: 47/47 verdes; build OK.

- [ ] **Step 4: Verificación visual final + commit**

Recorrer las 4 superficies (home, globo, ventana perfil, ventana stats) + login/register en `:4200` contra la muestra Nebula. Commit:
```bash
cd "D:/satelites-app" && git add -A
git commit -m "feat(front): Nebula fase 6 — consistencia, reduced-motion y accesibilidad"
```

---

## Self-Review (completado al escribir el plan)

- **Cobertura del spec:** tokens ✓ (T1); componentes base glass/botones/segmentado ✓ (T1, styles.css); fondo nebulosa ✓ (T1); window recto ✓ (T1); home ✓ (T2); HUD/paneles del globo ✓ (T3); medidor RAG ✓ (T3); perfil de pase NASA ✓ (T4); multi-serie favoritos + re-tema chart.js ✓ (T4); ventana perfil ✓ (T5); ventana stats + stat tiles ✓ (T5); restricciones (reduced-motion/accesibilidad/consistencia) ✓ (T6).
- **Placeholders:** el código de tokens, `NebulaBackground` y `ProximityGauge` está completo. Las fases de aplicación CSS (T3–T5) dan los selectores/estilos clave y piden ajustar a los selectores reales del template al ejecutar, porque son restyles sobre HTML existente que el ejecutor debe leer; los valores (colores, radios, sombras) son exactos y vienen de la muestra aprobada.
- **Consistencia de tipos:** `NebulaBackground` (selector `app-nebula-background`), `ProximityGauge` (`app-proximity-gauge`, inputs `value`/`label`, `pct` computed), clases globales `.glass/.btn/.seg/.text-grad` — usados igual en todas las tareas.
- **Riesgos/notas:** T4 (chart.js) y T1 (backdrop-filter/canvas) no corren en jsdom; se validan con build + revisión visual. El perfil de pase es una campana escalada por `maxElevation` (marca visual, no recomputo de la serie) — documentado. Si un test de stats asume la config vieja del chart, ajustarlo sin cambiar la lógica.
