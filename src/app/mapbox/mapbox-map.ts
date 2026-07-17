import { Component, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { SatellitesService, Sat, PosSat } from '../satellites.service';

// Versión "Mapbox" del visualizador, hecha con MapLibre GL JS: el fork OPEN-SOURCE de Mapbox GL
// (misma API), gratis y sin token ni cuenta. Estilo libre de Carto (dark), proyección de globo.
// Reusa satellites.service (loadTLEs + positionsAt + orbitPath) — no duplica lógica de dominio.
@Component({
  selector: 'app-mapbox-map',
  template: `
    <div class="wrap">
      <div #map class="map"></div>
      <div class="hud">🛰️ {{ count() }} satélites {{ live() ? 'en vivo' : 'en órbita' }} · tocá uno</div>
    </div>
  `,
  styles: [
    `
      .wrap { position: relative; width: 100vw; height: calc(100vh - 44px); background: #060911; }
      .map { position: absolute; inset: 0; }
      .hud {
        position: absolute; top: 16px; left: 16px; z-index: 2;
        color: #e9f2ff; font: 600 14px/1 system-ui, sans-serif;
        background: rgba(16, 20, 34, 0.62); padding: 10px 16px; border-radius: 4px;
        border: 1px solid rgba(0, 229, 255, 0.22); backdrop-filter: blur(12px);
      }
      /* popup de MapLibre tematizado */
      :host ::ng-deep .maplibregl-popup-content {
        background: #0d1120; color: #e9f2ff; border: 1px solid rgba(0, 229, 255, 0.3);
        border-radius: 4px; font: 400 12px/1.5 ui-monospace, monospace;
      }
      :host ::ng-deep .maplibregl-popup-content b { color: #00e5ff; }
      :host ::ng-deep .maplibregl-popup-tip { border-top-color: #0d1120; border-bottom-color: #0d1120; }
      :host ::ng-deep .maplibregl-popup-close-button { color: #9fb3c8; }
    `,
  ],
})
export class MapboxMap implements OnDestroy {
  private sats = inject(SatellitesService);
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  readonly count = signal(0);
  readonly live = signal(true);

  private map?: maplibregl.Map;
  private tles: Sat[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private selectedNorad: number | null = null;

  constructor() {
    afterNextRender(() => this.init());
  }

  private init() {
    this.map = new maplibregl.Map({
      container: this.mapEl().nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // libre, sin key
      center: [-60, -15],
      zoom: 1.4,
    });

    this.map.on('load', () => {
      const m = this.map!;
      m.setProjection({ type: 'globe' }); // MapLibre v5: globo + atmósfera

      // órbita del satélite seleccionado (línea)
      m.addSource('orbit', { type: 'geojson', data: this.lineFC([]) });
      m.addLayer({
        id: 'orbit',
        type: 'line',
        source: 'orbit',
        paint: { 'line-color': '#00e5ff', 'line-width': 1.5, 'line-opacity': 0.85 },
      });

      // satélites (puntos)
      m.addSource('sats', { type: 'geojson', data: this.pointsFC([]) });
      m.addLayer({
        id: 'sats',
        type: 'circle',
        source: 'sats',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'norad'], this.selectedNorad ?? -1], 6, 3],
          'circle-color': ['case', ['==', ['get', 'norad'], this.selectedNorad ?? -1], '#00e5ff', '#ffffff'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#7c3aed',
        },
      });

      m.on('mouseenter', 'sats', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'sats', () => (m.getCanvas().style.cursor = ''));
      m.on('click', 'sats', (e) => this.onSatClick(e));
      // clic en el vacío (sin satélite debajo) -> deseleccionar
      m.on('click', (e) => {
        if (!m.queryRenderedFeatures(e.point, { layers: ['sats'] }).length) this.deselect();
      });

      this.load();
    });
  }

  private load() {
    this.sats.loadTLEs('visual').subscribe(({ sats, live }) => {
      this.tles = sats;
      this.live.set(live);
      this.count.set(sats.length);
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    });
  }

  private tick() {
    if (!this.map) return;
    const pts = this.sats.positionsAt(this.tles, new Date());
    (this.map.getSource('sats') as maplibregl.GeoJSONSource | undefined)?.setData(this.pointsFC(pts));
  }

  private onSatClick(e: maplibregl.MapLayerMouseEvent) {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const p = f.properties as { name: string; norad: number; altKm: number; speed: number; periodMin: number; inclDeg: number };
    this.selectedNorad = p.norad;

    // resaltar el seleccionado
    this.map!.setPaintProperty('sats', 'circle-radius', ['case', ['==', ['get', 'norad'], p.norad], 6, 3]);
    this.map!.setPaintProperty('sats', 'circle-color', ['case', ['==', ['get', 'norad'], p.norad], '#00e5ff', '#ffffff']);

    // dibujar su órbita
    const sat = this.tles.find((s) => Number(s.satrec.satnum) === p.norad);
    const orbit = sat ? this.sats.orbitPath(sat, new Date()) : [];
    (this.map!.getSource('orbit') as maplibregl.GeoJSONSource | undefined)?.setData(
      this.lineFC(orbit.map((o) => [o.lng, o.lat])),
    );

    // popup con telemetría
    const [lng, lat] = f.geometry.coordinates as [number, number];
    new maplibregl.Popup({ closeButton: true, offset: 8 })
      .setLngLat([lng, lat])
      .setHTML(
        `<b>${p.name}</b><br>Alt ${p.altKm.toFixed(0)} km<br>Vel ${p.speed.toFixed(2)} km/s<br>` +
          `Período ${p.periodMin.toFixed(0)} min<br>Incl ${p.inclDeg.toFixed(1)}°`,
      )
      .addTo(this.map!);
  }

  private deselect() {
    if (!this.map || this.selectedNorad === null) return;
    this.selectedNorad = null;
    this.map.setPaintProperty('sats', 'circle-radius', 3);
    this.map.setPaintProperty('sats', 'circle-color', '#ffffff');
    (this.map.getSource('orbit') as maplibregl.GeoJSONSource | undefined)?.setData(this.lineFC([]));
  }

  private pointsFC(pts: PosSat[]) {
    return {
      type: 'FeatureCollection' as const,
      features: pts.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          name: p.name,
          norad: p.norad,
          altKm: p.altKm,
          speed: p.speed,
          periodMin: p.periodMin,
          inclDeg: p.inclDeg,
        },
      })),
    };
  }

  private lineFC(coords: [number, number][]) {
    return {
      type: 'FeatureCollection' as const,
      features: coords.length
        ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: coords }, properties: {} }]
        : [],
    };
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.map?.remove();
  }
}
