import { Component, ElementRef, computed, effect, inject, signal, viewChild, OnDestroy } from '@angular/core';
import Chart from 'chart.js/auto';
import { SatellitesService, Sat } from '../satellites.service';
import { AuthService } from '../auth/auth.service';
import { FavoritesService } from '../favorites/favorites.service';
import { bucketByElevation, passesToSeries } from './stats.util';

// Tema Nebula para los ejes de chart.js (grilla tenue + ticks mono), compartido por todos los gráficos.
const AXIS_GRID = { color: 'rgba(159,179,200,0.16)' };
const AXIS_TICKS = { color: '#9fb3c8', font: { family: 'ui-monospace, SF Mono, monospace', size: 10 } };

type CompareDataset = { label: string; data: (number | null)[]; borderColor: string; backgroundColor: string; tension: number; pointRadius: number };

@Component({
  selector: 'app-stats',
  imports: [],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnDestroy {
  private sats = inject(SatellitesService);
  private auth = inject(AuthService);
  private favs = inject(FavoritesService);
  private overheadCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overheadChart');
  private passesCanvas = viewChild<ElementRef<HTMLCanvasElement>>('passesChart');
  private compareCanvas = viewChild<ElementRef<HTMLCanvasElement>>('compareChart');

  readonly observer = signal<{ lat: number; lng: number } | null>(null);
  readonly geoError = signal('');
  readonly overheadTotal = signal(0);
  private tles: Sat[] = [];
  private charts: Chart[] = [];

  // TLEs cargados una vez (mapa norad -> Sat), igual que en profile.ts, para propagar los favoritos.
  private readonly tleByNorad = signal<Map<number, Sat> | null>(null);

  // Altitud (km) de cada favorito activo en ~la última hora (8 muestras), para el gráfico comparativo.
  readonly compareSeries = computed<{ labels: string[]; datasets: CompareDataset[] } | null>(() => {
    const tle = this.tleByNorad();
    const active = this.favs.items().filter((f) => !f.archived);
    if (!tle || !active.length) return null;
    const N = 8;
    const now = Date.now();
    const step = (60 * 60 * 1000) / (N - 1);
    const times = Array.from({ length: N }, (_, i) => new Date(now - (N - 1 - i) * step));
    const labels = times.map((t) => `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
    const datasets: CompareDataset[] = [];
    for (const f of active) {
      const sat = tle.get(f.norad_id);
      if (!sat) continue;
      datasets.push({
        label: f.sat_name,
        data: times.map((t) => this.sats.positionsAt([sat], t)[0]?.altKm ?? null),
        borderColor: f.color ?? '#00e5ff',
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
      });
    }
    return datasets.length ? { labels, datasets } : null;
  });

  constructor() {
    const u = this.auth.user();
    if (u?.home_lat != null && u?.home_lng != null) this.observer.set({ lat: u.home_lat, lng: u.home_lng });
    if (this.auth.isLoggedIn()) this.favs.reload();
    this.sats.loadTLEs('visual').subscribe(({ sats }) => {
      // ponytail: brief called afterNextRender() here, but it fires outside the
      // constructor's injection context once the HTTP response arrives (NG0203).
      // Unnecessary anyway: this callback always runs async, so the view is
      // already initialized and viewChild() refs are already available.
      this.tles = sats;
      const m = new Map<number, Sat>();
      for (const s of sats) m.set(Number(s.satrec.satnum), s);
      this.tleByNorad.set(m);
      this.render();
    });
    // Redibuja el comparativo cuando cambian los favoritos, los TLEs, o el canvas recién queda montado.
    effect(() => this.drawCompare(this.compareSeries()));
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
    this.overheadTotal.set(buckets.reduce((sum, b) => sum + b.count, 0));
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
    Chart.getChart(ctx)?.destroy();
    this.charts.push(new Chart(ctx, {
      type,
      data: { labels, datasets: [{ label, data, backgroundColor: 'rgba(0,229,255,0.6)' }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#c8d6e5' } } }, scales: { x: { grid: AXIS_GRID, ticks: AXIS_TICKS }, y: { grid: AXIS_GRID, ticks: AXIS_TICKS, beginAtZero: true } } },
    }));
  }

  // Gráfico "Comparar favoritos": una línea por favorito, altitud (km) en el eje Y. Guarda si no hay canvas/ctx (jsdom).
  private drawCompare(series: { labels: string[]; datasets: CompareDataset[] } | null) {
    const ctx = this.compareCanvas()?.nativeElement?.getContext('2d');
    if (!ctx) return;
    Chart.getChart(ctx)?.destroy();
    if (!series) return;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: { labels: series.labels, datasets: series.datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { color: '#c8d6e5' } } },
        scales: { x: { grid: AXIS_GRID, ticks: AXIS_TICKS }, y: { grid: AXIS_GRID, ticks: AXIS_TICKS } },
      },
    }));
  }

  ngOnDestroy() {
    this.charts.forEach((c) => c.destroy());
  }
}
