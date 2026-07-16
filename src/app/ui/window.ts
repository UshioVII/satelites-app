import { Component, input, output, signal, OnInit } from '@angular/core';

// Ventana flotante estilo SO: se arrastra desde la barra de título, se minimiza y se cierra.
// El contenido va por ng-content. Posición y foco (z-index) se manejan localmente.
@Component({
  selector: 'app-window',
  template: `
    <div
      class="win"
      [style.left.px]="x()"
      [style.top.px]="y()"
      [style.zIndex]="z()"
      [class.min]="minimized()"
      [class.closing]="closing()"
      (mousedown)="focus()"
    >
      <div class="bar" (mousedown)="startDrag($event)">
        <span class="title">{{ title() }}</span>
        <span class="btns">
          <button type="button" (click)="minimized.set(!minimized())" [title]="minimized() ? 'Restaurar' : 'Minimizar'">
            {{ minimized() ? '▢' : '—' }}
          </button>
          <button type="button" class="close" (click)="requestClose()" title="Cerrar">✕</button>
        </span>
      </div>
      @if (!minimized()) {
        <div class="body"><ng-content /></div>
      }
    </div>
  `,
  styleUrl: './window.css',
})
export class Window implements OnInit {
  readonly title = input('Ventana');
  readonly initialX = input(90);
  readonly initialY = input(90);
  readonly close = output<void>();

  readonly x = signal(90);
  readonly y = signal(90);
  readonly minimized = signal(false);
  readonly closing = signal(false);

  // z-index compartido: al enfocar una ventana sube por encima de las demás.
  private static top = 100;
  readonly z = signal(++Window.top);

  ngOnInit() {
    this.x.set(this.initialX());
    this.y.set(this.initialY());
  }

  focus() {
    this.z.set(++Window.top);
  }

  // Cierre animado: marca .closing (CSS reproduce el fade-out) y recién emite close al terminar.
  // Con prefers-reduced-motion se salta la animación y cierra al instante.
  requestClose() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.close.emit();
      return;
    }
    this.closing.set(true);
    setTimeout(() => this.close.emit(), 180);
  }

  startDrag(e: MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = this.x();
    const oy = this.y();
    const move = (ev: MouseEvent) => {
      this.x.set(Math.max(0, ox + ev.clientX - startX));
      this.y.set(Math.max(0, oy + ev.clientY - startY));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}
