import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { WindowsService } from '../ui/windows.service';
import { NebulaBackground } from '../ui/nebula-background';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NebulaBackground],
  template: `
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
  `,
  styles: [`
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
  `],
})
export class Home {
  readonly auth = inject(AuthService);
  readonly win = inject(WindowsService);
}
