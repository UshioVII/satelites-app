import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

// Host global de toasts: se monta una vez en app.html. Abajo a la derecha, arriba del
// dock del globo (bottom: 84px) para no taparlo.
@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-host" role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast" [class.ok]="t.kind === 'ok'" [class.error]="t.kind === 'error'" (click)="toasts.dismiss(t.id)">
          {{ t.text }}
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.css',
})
export class ToastHost {
  protected toasts = inject(ToastService);
}
