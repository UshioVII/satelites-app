import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import GlobeGl from 'globe.gl';
import { SatellitesService, Sat, PosSat, OverheadSat, Pass, compass } from '../satellites.service';
import { SatInfo } from '../sat/sat-info';

export type VizMode = 'points' | 'heatmap' | 'hexbin';

@Component({
  selector: 'app-globe',
  imports: [DecimalPipe, DatePipe, SatInfo],
  templateUrl: './globe.html',
  styleUrl: './globe.css',
})
export class Globe implements OnDestroy {
  private sats = inject(SatellitesService);
  private globeEl = viewChild.required<ElementRef<HTMLDivElement>>('globe');

  readonly count = signal(0);
  readonly loadState = signal<'loading' | 'ok' | 'error'>('loading'); // estado de carga de TLEs
  readonly live = signal(true); // false = usando snapshot de respaldo (CelesTrak caido)
  readonly selected = signal<PosSat | null>(null);
  readonly selectedNorad = signal<number | null>(null);
  readonly observer = signal<{ lat: number; lng: number } | null>(null); // tu ubicacion
  readonly overhead = signal<OverheadSat[]>([]); // satelites sobre vos ahora
  readonly passes = signal<Pass[]>([]); // proximos pases del satelite seleccionado sobre vos
  readonly geoError = signal('');
  readonly vizMode = signal<VizMode>('points');

  readonly compass = compass; // para el template

  private tles: Sat[] = [];
  private points: PosSat[] = [];
  private globe: any;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.loadSatellites();
    afterNextRender(() => this.initGlobe());
  }

  // Carga los TLEs. Antes fallaba en silencio (globo negro sin explicacion); ahora
  // expone loadState para que la UI muestre carga/error y ofrezca reintentar.
  loadSatellites() {
    this.loadState.set('loading');
    this.sats.loadTLEs('visual').subscribe({
      next: ({ sats, live }) => {
        this.tles = sats;
        this.count.set(sats.length);
        this.live.set(live);
        this.loadState.set(sats.length ? 'ok' : 'error'); // ni live ni respaldo trajeron datos
        this.tick(); // pinta apenas llegan, sin esperar el proximo intervalo
      },
      error: () => this.loadState.set('error'), // fallo hasta el respaldo bundleado
    });
  }

  private initGlobe() {
    this.globe = new GlobeGl(this.globeEl().nativeElement)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.01)
      .pointRadius((d: any) => (this.selected()?.name === d.name ? 0.7 : 0.32))
      .pointColor((d: any) => (this.selected()?.name === d.name ? '#00e5ff' : '#ffffff'))
      .onPointClick((d: any) => this.select(d))
      .onGlobeClick(() => this.deselect())
      // orbita (linea)
      .pathPointLat((p: any) => p.lat)
      .pathPointLng((p: any) => p.lng)
      .pathPointAlt(0.012)
      .pathColor(() => '#00e5ff')
      .pathStroke(1.6)
      // tu ubicacion (anillo pulsante)
      .ringColor(() => '#39ff88')
      .ringMaxRadius(5)
      .ringPropagationSpeed(2)
      .ringRepeatPeriod(700)
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

    this.globe.controls().autoRotate = true;
    this.globe.controls().autoRotateSpeed = 0.5;

    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  private tick() {
    if (!this.globe || !this.tles.length) return;
    if (this.observer()) this.updateOverhead(); // el overhead sigue vivo aunque haya seleccion
    if (this.selected()) return; // congelado si hay un satelite seleccionado
    this.points = this.sats.positionsAt(this.tles, new Date());
    this.applyViz();
  }

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

  private select(d: PosSat) {
    this.selected.set(d);
    this.globe.controls().autoRotate = false;
    this.globe.pointsData(this.points);
    const sat = this.tles.find((s) => s.name === d.name);
    this.selectedNorad.set(sat ? Number(sat.satrec.satnum) : null);
    this.globe.pathsData(sat ? [this.sats.orbitPath(sat, new Date())] : []);
    this.updatePasses(sat);
  }

  deselect() {
    if (!this.selected()) return;
    this.selected.set(null);
    this.selectedNorad.set(null);
    this.passes.set([]);
    this.globe.controls().autoRotate = true;
    this.globe.pathsData([]);
    this.globe.pointsData(this.points);
  }

  // Recalcula los proximos pases del satelite seleccionado sobre tu ubicacion.
  private updatePasses(sat?: Sat) {
    const o = this.observer();
    const s = sat ?? this.tles.find((t) => t.name === this.selected()?.name);
    this.passes.set(o && s ? this.sats.nextPasses(s, o.lat, o.lng, new Date()) : []);
  }

  // Pide tu ubicacion al navegador y calcula que satelites tenes encima.
  locateMe() {
    if (!navigator.geolocation) {
      this.geoError.set('Tu navegador no tiene geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.observer.set(o);
        this.geoError.set('');
        this.globe.ringsData([o]); // marca tu ubicacion
        this.globe.pointOfView({ lat: o.lat, lng: o.lng, altitude: 2.2 }, 1200); // vuela hacia vos
        this.updateOverhead();
        this.updatePasses(); // si ya habia un satelite seleccionado, ahora podemos predecir sus pases
      },
      (err) => this.geoError.set('No pudimos obtener tu ubicación: ' + err.message),
    );
  }

  private updateOverhead() {
    const o = this.observer();
    if (!o) return;
    this.overhead.set(this.sats.overhead(this.tles, o.lat, o.lng, new Date()));
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
