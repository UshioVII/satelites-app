import { Component, ElementRef, inject, signal, viewChild, OnDestroy } from '@angular/core';
import Chart from 'chart.js/auto';
import { SatellitesService, Sat } from '../satellites.service';
import { AuthService } from '../auth/auth.service';
import { bucketByElevation, passesToSeries } from './stats.util';

@Component({
  selector: 'app-stats',
  imports: [],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats implements OnDestroy {
  private sats = inject(SatellitesService);
  private auth = inject(AuthService);
  private overheadCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overheadChart');
  private passesCanvas = viewChild<ElementRef<HTMLCanvasElement>>('passesChart');

  readonly observer = signal<{ lat: number; lng: number } | null>(null);
  readonly geoError = signal('');
  private tles: Sat[] = [];
  private charts: Chart[] = [];

  constructor() {
    const u = this.auth.user();
    if (u?.home_lat != null && u?.home_lng != null) this.observer.set({ lat: u.home_lat, lng: u.home_lng });
    this.sats.loadTLEs('visual').subscribe(({ sats }) => {
      // ponytail: brief called afterNextRender() here, but it fires outside the
      // constructor's injection context once the HTTP response arrives (NG0203).
      // Unnecessary anyway: this callback always runs async, so the view is
      // already initialized and viewChild() refs are already available.
      this.tles = sats;
      this.render();
    });
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
      options: { responsive: true, plugins: { legend: { labels: { color: '#c8d6e5' } } }, scales: { x: { ticks: { color: '#9fb3c8' } }, y: { ticks: { color: '#9fb3c8' }, beginAtZero: true } } },
    }));
  }

  ngOnDestroy() {
    this.charts.forEach((c) => c.destroy());
  }
}
