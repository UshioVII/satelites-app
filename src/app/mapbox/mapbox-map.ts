import { Component, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { SatellitesService, Sat, PosSat } from '../satellites.service';
import { MAPBOX_TOKEN } from './mapbox.config';

// Versión Mapbox del visualizador: la misma data de satélites (satellites.service) plotteada
// sobre un mapa de Mapbox con proyección de globo. Reusa loadTLEs + positionsAt (sin lógica nueva).
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
      <div class="hud">🛰️ {{ count() }} satélites {{ live() ? 'en vivo' : 'en órbita' }}</div>
    </div>
  `,
  styles: [
    `
      .wrap { position: relative; width: 100vw; height: calc(100vh - 44px); background: #060911; }
      .map { position: absolute; inset: 0; }
      .hud {
        position: absolute; top: 16px; left: 16px; z-index: 2;
        color: #e9f2ff; font: 600 15px/1 system-ui, sans-serif;
        background: rgba(16, 20, 34, 0.62); padding: 10px 16px; border-radius: 4px;
        border: 1px solid rgba(0, 229, 255, 0.22); backdrop-filter: blur(12px);
      }
      .notoken {
        position: absolute; inset: 0; z-index: 3; display: grid; place-content: center; text-align: center;
        gap: 0.4rem; padding: 2rem; color: #9fb3c8;
      }
      .notoken h2 { color: #00e5ff; margin: 0; }
      .notoken code { color: #e9f2ff; background: #0d1120; padding: 0.1rem 0.3rem; border-radius: 3px; }
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
      this.map!.setFog({}); // atmósfera del globo (look espacial)
      this.map!.addSource('sats', { type: 'geojson', data: this.featureCollection([]) });
      this.map!.addLayer({
        id: 'sats',
        type: 'circle',
        source: 'sats',
        paint: {
          'circle-radius': 3,
          'circle-color': '#00e5ff',
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#7c3aed',
        },
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
    const src = this.map.getSource('sats') as mapboxgl.GeoJSONSource | undefined;
    src?.setData(this.featureCollection(pts));
  }

  private featureCollection(pts: PosSat[]) {
    return {
      type: 'FeatureCollection' as const,
      features: pts.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { name: p.name },
      })),
    };
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.map?.remove();
  }
}
