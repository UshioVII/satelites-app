import { Component, inject, afterNextRender } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { ToastHost } from './ui/toast-host';
import { SoundService } from './ui/sound.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  protected sound = inject(SoundService);

  constructor() {
    // Un solo listener global cubre todos los botones/enlaces interactivos.
    afterNextRender(() => {
      document.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button, a.btn, .dock-btn, .cta, .seg button, .nav .link')) {
          this.sound.click();
        }
      });
    });
  }
}
