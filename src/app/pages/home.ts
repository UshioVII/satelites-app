import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <h1>🛰️ Satélites</h1>
      <p class="lead">
        Visualizador 3D de satélites en tiempo real. Seguí la Estación Espacial y cientos de
        objetos en órbita, mirá qué tenés sobre tu cabeza ahora mismo y predecí sus próximos pases.
      </p>
      <ul class="feats">
        <li>Globo 3D en vivo con datos TLE reales (CelesTrak)</li>
        <li>Elegí un satélite y vé su órbita, telemetría e info de Wikipedia</li>
        <li>Guardá favoritos y notas, con tu perfil y estadísticas</li>
      </ul>
      <div class="cta">
        <a class="btn" routerLink="/globe">Ver el globo</a>
        @if (auth.isLoggedIn()) {
          <a class="btn ghost" routerLink="/profile">Mi perfil</a>
        } @else {
          <a class="btn ghost" routerLink="/login">Entrar</a>
        }
      </div>
      <p class="stack">Angular 22 · globe.gl · satellite.js · Node/Express + SQLite</p>
    </section>
  `,
  styles: [`
    .hero { max-width: 46rem; margin: 3rem auto; padding: 0 1.2rem; color: #e6f1ff; animation: hero-in 0.4s ease-out; }
    @keyframes hero-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .hero h1 { font-size: 2.4rem; margin: 0 0 0.5rem; }
    .lead { color: #9fb3c8; font-size: 1.1rem; line-height: 1.6; }
    .feats { color: #c8d6e5; line-height: 1.8; }
    .cta { display: flex; gap: 0.8rem; margin: 1.4rem 0; }
    .btn { padding: 0.7rem 1.2rem; border-radius: 8px; background: #00e5ff; color: #051018; text-decoration: none; font-weight: 700; }
    .btn.ghost { background: transparent; color: #00e5ff; border: 1px solid #00e5ff; }
    .stack { color: #5b6b7f; font-size: 0.85rem; }
  `],
})
export class Home {
  readonly auth = inject(AuthService);
}
