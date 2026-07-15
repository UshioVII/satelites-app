import { Injectable, signal } from '@angular/core';

// Estado de las ventanas flotantes del shell (perfil, stats). Compartido para que el nav
// y otras vistas (home) puedan abrirlas sin navegar a una página aparte.
@Injectable({ providedIn: 'root' })
export class WindowsService {
  readonly profileOpen = signal(false);
  readonly statsOpen = signal(false);

  openProfile() {
    this.profileOpen.set(true);
  }
  openStats() {
    this.statsOpen.set(true);
  }
}
