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
import { AuthService } from '../auth/auth.service';
import { FavoritesService } from '../favorites/favorites.service';
import { dedupeSats } from './globe.util';
import { ProximityGauge } from '../ui/proximity-gauge';
import { Window } from '../ui/window';
import { Profile } from '../profile/profile';
import { Stats } from '../stats/stats';

export type VizMode = 'points' | 'heatmap';

@Component({
  selector: 'app-globe',
  imports: [DecimalPipe, DatePipe, SatInfo, ProximityGauge, Window, Profile, Stats],
  templateUrl: './globe.html',
  styleUrl: './globe.css',
})
export class Globe implements OnDestroy {
  private sats = inject(SatellitesService);
  protected auth = inject(AuthService);
  private favs = inject(FavoritesService);
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
  readonly autoRotateOn = signal(false); // tierra quieta por defecto; el usuario prende la rotación

  // Ventanas SO abiertas desde el dock (la ficha del satélite usa selected() como estado abierto).
  readonly overheadOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly statsOpen = signal(false);

  readonly compass = compass; // para el template

  // Posiciones iniciales de las ventanas (se leen una vez al montar cada Window).
  get satWinX() { return Math.max(24, innerWidth - 320 - 24); } // ficha a la derecha
  get overheadX() { return Math.max(0, (innerWidth - 360) / 2); } // "sobre vos" centrada

  // Abre la ventana "sobre vos": pide ubicación solo la primera vez.
  openOverhead() {
    if (!this.observer()) this.locateMe();
    this.overheadOpen.set(true);
  }

  private tles: Sat[] = [];
  private points: PosSat[] = [];
  private globe: any;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    const saved = this.auth.user()?.viz_mode as VizMode | undefined;
    if (saved === 'points' || saved === 'heatmap') {
      this.vizMode.set(saved);
    }
    if (this.auth.isLoggedIn()) this.favs.reload(); // colores de favoritos para pintarlos en el globo
    this.loadSatellites();
    afterNextRender(() => this.initGlobe());
  }

  // Carga los TLEs. Antes fallaba en silencio (globo negro sin explicacion); ahora
  // expone loadState para que la UI muestre carga/error y ofrezca reintentar.
  loadSatellites() {
    this.loadState.set('loading');
    this.sats.loadTLEs('visual').subscribe({
      next: ({ sats, live }) => {
        this.tles = dedupeSats(sats);
        this.count.set(this.tles.length);
        this.live.set(live);
        this.loadState.set(sats.length ? 'ok' : 'error'); // ni live ni respaldo trajeron datos
        this.tick(); // pinta apenas llegan, sin esperar el proximo intervalo
        this.applyHeatmap(); // refresca el snapshot de densidad con los datos ya cargados
      },
      error: () => this.loadState.set('error'), // fallo hasta el respaldo bundleado
    });
  }

  private initGlobe() {
    this.globe = new GlobeGl(this.globeEl().nativeElement)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.01)
      .pointRadius((d: any) => {
        if (this.selected()?.norad === d.norad) return 0.7;
        if (this.favs.colorByNorad().has(d.norad)) return 0.5; // los favoritos resaltan un poco más
        return this.vizMode() === 'points' ? 0.32 : 0.18;
      })
      .pointColor((d: any) => {
        if (this.selected()?.norad === d.norad) return '#00e5ff';
        const fav = this.favs.colorByNorad().get(d.norad);
        if (fav) return fav; // el favorito se pinta con su color elegido
        return this.vizMode() === 'points' ? '#ffffff' : 'rgba(255,255,255,0.35)';
      })
      .pointsTransitionDuration(0)
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
      .heatmapsTransitionDuration(0); // sin animación al re-setear datos

    this.globe.controls().autoRotateSpeed = 0.5;
    this.updateAutoRotate();

    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
    this.applyHeatmap(); // si el modo guardado es Calor, pintarlo una vez al iniciar
  }

  // Rota solo si el usuario lo prendió Y no hay selección ni ubicación fijada (para leer quieto).
  private updateAutoRotate() {
    if (!this.globe) return;
    this.globe.controls().autoRotate = this.autoRotateOn() && !this.selected() && !this.observer();
  }

  toggleRotate() {
    this.autoRotateOn.set(!this.autoRotateOn());
    this.updateAutoRotate();
  }

  private tick() {
    if (!this.globe || !this.tles.length) return;
    if (this.observer()) this.updateOverhead(); // el overhead sigue vivo aunque haya seleccion
    this.points = this.sats.positionsAt(this.tles, new Date());
    this.applyViz();
    // El seleccionado y el resto siguen moviéndose: refrescamos su posición/telemetría en vivo.
    const sel = this.selected();
    if (sel) {
      const fresh = this.points.find((p) => p.norad === sel.norad);
      if (fresh) this.selected.set(fresh);
    }
  }

  // Por tick: solo la capa de puntos (satélites en movimiento y clickeables en todos los modos).
  // El heatmap NO se re-arma acá: reconstruirlo cada segundo causaba el parpadeo del modo Calor.
  private applyViz() {
    if (!this.globe) return;
    this.globe.pointsData(this.points);
  }

  // Snapshot del heatmap de densidad. Se llama solo al cambiar de modo o al cargar datos,
  // no por tick (la densidad casi no cambia segundo a segundo y así no parpadea).
  private applyHeatmap() {
    if (!this.globe) return;
    this.globe.heatmapsData(this.vizMode() === 'heatmap' ? [this.points] : []);
  }

  changeViz(mode: VizMode) {
    this.vizMode.set(mode);
    this.applyViz();
    this.applyHeatmap();
    if (this.auth.isLoggedIn()) {
      this.auth.updateProfile({ viz_mode: mode }).subscribe();
    }
  }

  private select(d: PosSat) {
    this.selected.set(d);
    this.updateAutoRotate();
    this.applyViz();
    const sat = this.tles.find((s) => Number(s.satrec.satnum) === d.norad);
    this.selectedNorad.set(d.norad);
    this.globe.pathsData(sat ? [this.sats.orbitPath(sat, new Date())] : []);
    this.updatePasses(sat);
  }

  deselect() {
    if (!this.selected()) return;
    this.selected.set(null);
    this.selectedNorad.set(null);
    this.passes.set([]);
    this.updateAutoRotate();
    this.globe.pathsData([]);
    this.applyViz();
  }

  // Recalcula los proximos pases del satelite seleccionado sobre tu ubicacion.
  private updatePasses(sat?: Sat) {
    const o = this.observer();
    const s = sat ?? this.tles.find((t) => Number(t.satrec.satnum) === this.selected()?.norad);
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
        this.updateAutoRotate();
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
