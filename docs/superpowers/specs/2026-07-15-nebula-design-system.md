# Nebula — Sistema de diseño de satelites-app

> Rediseño visual del frontend. La app ya está funcionalmente completa; esto NO cambia
> lógica ni datos, solo la capa visual (tokens, componentes, gráficos, layout).

## Dirección

Estética "wow" moderna (referencias de Diego: Aceternity / cult-ui) aterrizada en un
tablero técnico de misión espacial:

- Fondo casi-negro con sesgo violeta + superficies **glass** (blur + borde).
- Gradiente de marca **cyan → violeta → índigo**, usado con moderación (títulos, estados activos, números clave).
- **Glow** neón cyan/violeta en acentos.
- **Look enterprise: todo recto** (esquinas ~2-4px, no redondeadas).
- **Motion contenido**: entradas fade-up, hover glow/scale, barrido de brillo en botones, fondo nebulosa a la deriva. Siempre con `prefers-reduced-motion`.
- **Telemetría y labels en monospace** (toque HUD).
- **Color semántico separado del acento**: escala RAG intensa (rojo/amarillo/verde) para proximidad, y ok/aviso/peligro para estados.

Muestra aprobada (artifact "Nebula v0.4"). Este doc traduce esa muestra a la app.

## Tokens

Definir como custom properties en el stylesheet global (`src/styles.css`). Tema único
oscuro (compromiso deliberado con el mundo visual espacial).

```
Grounds
--bg:            #060911   (fondo)
--bg-2:          #0a0e1a
--surface:       rgba(16,20,34,0.62)   (glass)
--surface-solid: #0d1120

Acentos
--cyan:   #00e5ff   (héroe)
--violet: #7c3aed
--indigo: #4f46e5
--brand:  linear-gradient(100deg, #00e5ff 0%, #7c3aed 55%, #4f46e5 100%)

Texto
--ink:   #e9f2ff   --ink-2: #9fb3c8   --ink-3: #5b6b7f

Semántico (estado)
--ok: #39ff88   --warn: #ffcf6b   --danger: #ff5b5b

Proximidad (RAG intenso)
--far: #ff2e2e   --near: #ffcc00   --close: #1fff87

Líneas / glow
--line:        rgba(0,229,255,0.22)
--line-violet: rgba(124,58,237,0.28)
--glow-cyan:   0 0 0 1px rgba(0,229,255,0.25), 0 0 28px -6px rgba(0,229,255,0.55)
--glow-violet: 0 0 34px -8px rgba(124,58,237,0.6)

Forma / tipo
--radius: 4px        (enterprise, recto)
--radius-win: 2px
--mono: ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, monospace
--sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
```

Sin fuentes externas (CSP/rendimiento): sans y mono del sistema. Títulos con
`background: var(--brand); background-clip: text; color: transparent`.

## Componentes base

Utilidades globales + restyle de componentes existentes. Cada uno con foco único.

1. **Superficie glass** (`.panel` / mixin): `--surface` + `backdrop-filter: blur(14px)` + `1px var(--line)` + sombra + `--radius`.
2. **Borde-gradiente** (para cards destacadas, ej. panel del satélite): pseudo-elemento con `--brand` y máscara.
3. **Botones**: `primary` (relleno `--brand` + glow + barrido de brillo al hover), `ghost` (borde-gradiente, glow al hover). Radius 3px.
4. **Control segmentado** (viz Puntos/Calor): pill recto, activo con `--brand` + glow.
5. **Ventana flotante** (`Window`, ya existe): esquinas rectas (2px), barra de título con gradiente cyan/violeta tenue, botones minimizar/cerrar. Restyle del componente actual.
6. **Fondo ambiente** (`NebulaBackground`, nuevo): canvas de starfield (twinkle) + blobs de nebulosa CSS a la deriva. Se usa en home y detrás de las ventanas (NO sobre el globo, que ya es su propio fondo WebGL).

## Componentes de datos (gráficos)

1. **Medidor vertical RAG** (`ProximityGauge`, nuevo): barra vertical con 3 zonas (verde arriba, amarillo medio, rojo abajo) + marca de nivel actual + valor en mono. Entrada: valor 0–90° (elevación) o distancia normalizada. **Uso real:** panel "¿Qué tengo sobre mí?" (un gauge por satélite sobre el horizonte, alimentado por la elevación real).
2. **Perfil de pase estilo NASA** (single-serie): área/línea con glow, bandas RAG de fondo (baja/media/alta elevación), grilla, ejes en mono, punto de máximo. **Uso real:** "próximos pases" del satélite seleccionado (elevación vs tiempo, datos de `nextPasses`).
3. **Multi-serie** (comparar favoritos): una línea por favorito **con su color** (reusa C2), marcadores, grilla, ejes en mono, leyenda. **Uso real:** ventana Stats — altitud/elevación de los favoritos en el tiempo. Se implementa con **chart.js** (ya instalado), tematizado a Nebula.

Los gráficos consumen datos que la app ya calcula (`satellites.service`: `positionsAt`, `nextPasses`, `orbitPath`). Sin nueva lógica de dominio.

## Aplicación por pantalla

- **Home** (`pages/home.ts`): hero con título en gradiente, fondo nebulosa + starfield, lede, CTAs (primary/ghost con glow), cards de features glass con hover glow, entrada animada escalonada.
- **Globo — HUD y paneles** (`globe.html/.css`, `sat/*`): HUD glass recto con borde-gradiente; control segmentado de viz; panel del satélite como card premium (borde-gradiente, telemetría en mono); panel "sobre vos ahora" con **medidores RAG**; "próximos pases" con el **plot de pase NASA**. Botones (ubicación, rotar) con estilo Nebula.
- **Ventana Perfil** (`profile.*` dentro de `Window`): headers de sección, avatar con anillo gradiente, filas de favorito con chip de color (glow) + telemetría en mono.
- **Ventana Stats** (`stats.*` dentro de `Window`): stat tiles (número en gradiente + count-up + sparkline), **gráfico multi-serie** de favoritos, chart.js re-tematizado (grilla/labels/líneas en la paleta).

## Restricciones

- Autocontenido: sin CDN, sin webfonts externas, assets propios embebidos o del sistema.
- **Coexistir con el globo WebGL**: los paneles son glass sobre el globo vivo; en esa pantalla, animaciones GPU-livianas (nada de canvas de fondo compitiendo con el globo).
- `prefers-reduced-motion: reduce` desactiva animaciones no esenciales.
- Accesibilidad básica: foco visible, contraste legible del texto sobre glass, `aria-label` en gráficos.
- **No romper funcionalidad ni tests.** Los 47 tests de front y 28 de back deben seguir verdes; los cambios son de CSS/plantilla y componentes de presentación.

## Verificación

- Tests unitarios: sin cambios de lógica, deben seguir verdes (correr `node node_modules/@angular/cli/bin/bootstrap.js test --watch=false` y `... build`).
- Visual: revisar cada pantalla en el dev server (`:4200`) contra la muestra Nebula. Diego aprueba visualmente pantalla por pantalla.

## Fases de implementación (para el plan)

1. **Tokens + base**: `src/styles.css` con tokens y utilidades (glass, botones, segmentado); `NebulaBackground`; restyle del `Window` a recto/gradiente.
2. **Home**: aplicar hero + nebulosa + cards.
3. **Globo HUD/paneles**: HUD, panel satélite, botones; **medidor RAG** en "sobre vos ahora".
4. **Gráficos NASA**: plot de pase (sat-info) + multi-serie de favoritos (stats) + re-tema chart.js.
5. **Ventanas Perfil y Stats**: aplicar Nebula al contenido, stat tiles.
6. **Pase final**: consistencia, `prefers-reduced-motion`, accesibilidad, verificación visual por pantalla.

Cada fase es verificable (build + tests + revisión visual) y commiteable por separado.
