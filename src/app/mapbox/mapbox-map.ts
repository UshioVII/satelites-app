import { Component, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { SatellitesService, Sat, PosSat } from '../satellites.service';
import { MAPBOX_TOKEN } from './mapbox.config';

// Versión Mapbox del visualizador: la misma data de satélites (satellites.service) sobre un mapa
// de Mapbox con proyección de globo. Clic en un satélite -> popup con telemetría + su órbita.
// Reusa loadTLEs + positionsAt + orbitPath (sin lógica nueva de dominio).
@Component({
  selector: 'app-mapbox-map',
  template: `
    <div class="wrap">
      <div #map class="map"></div>
      @if (!hasToken) {
        <div class="notoken">
          <h2>Falta el token de Mapbox</h2>
          <p>
            Pegá tu token público (pk.…) en <code>src/app/mapbox/mapbox.config.ts</code>.
            Se saca gratis en <b>account.mapbox.com</b>.
          </p>
        </div>
      }
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
      .notoken {
        position: absolute; inset: 0; z-index: 3; display: grid; place-content: center; text-align: center;
        gap: 0.4rem; padding: 2rem; color: #9fb3c8;
      }
      .notoken h2 { color: #00e5ff; margin: 0; }
      .notoken code { color: #e9f2ff; background: #0d1120; padding: 0.1rem 0.3rem; border-radius: 3px; }
      /* popup de Mapbox tematizado */
      :host ::ng-deep .mapboxgl-popup-content {
        background: #0d1120; color: #e9f2ff; border: 1px solid rgba(0, 229, 255, 0.3);
        border-radius: 4px; font: 400 12px/1.5 ui-monospace, monospace;
      }
      :host ::ng-deep .mapboxgl-popup-content b { color: #00e5ff; }
      :host ::ng-deep .mapboxgl-popup-tip { border-top-color: #0d1120; border-bottom-color: #0d1120; }
      :host ::ng-deep .mapboxgl-popup-close-button { color: #9fb3c8; }
    `,
  ],
})
export class MapboxMap implements OnDestroy {
  private sats = inject(SatellitesService);
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  readonly hasToken = !!MAPBOX_TOKEN;
  readonly count = signal(0);
  readonly live = signal(true);

  private map?: mapboxgl.Map;
  private tles: Sat[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private selectedNorad: number | null = null;

  constructor() {
    afterNextRender(() => this.init());
  }

  private init() {
    if (!this.hasToken) return; // sin token no se puede inicializar Mapbox
    mapboxgl.accessToken = MAPBOX_TOKEN;
    this.map = new mapboxgl.Map({
      container: this.mapEl().nativeElement,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      center: [-60, -15],
      zoom: 1.4,
    });

    this.map.on('style.load', () => {
      const m = this.map!;
      m.setFog({}); // atmósfera del globo (look espacial)

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
    (this.map.getSource('sats') as mapboxgl.GeoJSONSource | undefined)?.setData(this.pointsFC(pts));
  }

  private onSatClick(e: mapboxgl.MapLayerMouseEvent) {
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
    (this.map!.getSource('orbit') as mapboxgl.GeoJSONSource | undefined)?.setData(
      this.lineFC(orbit.map((o) => [o.lng, o.lat])),
    );

    // popup con telemetría
    const [lng, lat] = f.geometry.coordinates as [number, number];
    new mapboxgl.Popup({ closeButton: true, offset: 8 })
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
    (this.map.getSource('orbit') as mapboxgl.GeoJSONSource | undefined)?.setData(this.lineFC([]));
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
