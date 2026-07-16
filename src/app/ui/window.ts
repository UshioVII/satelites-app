import { Component, input, output, signal, OnInit, ElementRef, inject, afterNextRender } from '@angular/core';

// Ventana flotante estilo SO: se arrastra desde la barra de título, se minimiza, se redimensiona y se cierra.
// El contenido va por ng-content. Posición, tamaño y foco (z-index) se manejan localmente.
@Component({
  selector: 'app-window',
  template: `
    <div
      class="win"
      [style.left.px]="x()"
      [style.top.px]="y()"
      [style.width.px]="w()"
      [style.height.px]="h()"
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
        <div class="resize" (mousedown)="startResize($event)"></div>
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

  private host = inject(ElementRef<HTMLElement>);

  readonly x = signal(90);
  readonly y = signal(90);
  readonly w = signal<number | null>(null);
  readonly h = signal<number | null>(null);
  readonly minimized = signal(false);
  readonly closing = signal(false);

  // z-index compartido: al enfocar una ventana sube por encima de las demás.
  private static top = 100;
  readonly z = signal(++Window.top);

  constructor() {
    afterNextRender(() => this.clampToViewport());
  }

  ngOnInit() {
    this.x.set(this.initialX());
    this.y.set(this.initialY());
  }

  // Corrige la posición inicial para que la ventana quede siempre dentro del viewport
  // (evita que quede cortada, ej. la ficha de satélite abriendo con la mitad afuera).
  private clampToViewport() {
    const box = this.host.nativeElement.querySelector('.win') as HTMLElement | null;
    if (!box) return;
    const w = box.offsetWidth, h = box.offsetHeight, m = 8;
    this.x.set(Math.min(Math.max(m, this.x()), Math.max(m, innerWidth - w - m)));
    // mantenemos al menos la barra de título alcanzable verticalmente
    this.y.set(Math.min(Math.max(m, this.y()), Math.max(m, innerHeight - 48)));
  }

  focus() {
    this.z.set(++Window.top);
  }

  // Cierre animado: marca .closing (CSS reproduce el fade-out) y recién emite close al terminar.
  // Con prefers-reduced-motion se salta la animación y cierra al instante.
  requestClose() {
    if (this.closing()) return; // evita doble-click disparando close() dos veces
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

  startResize(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // no debe arrancar un drag de la barra
    const box = this.host.nativeElement.querySelector('.win') as HTMLElement | null;
    const startX = e.clientX;
    const startY = e.clientY;
    const ow = this.w() ?? box?.offsetWidth ?? 320;
    const oh = this.h() ?? box?.offsetHeight ?? 200;
    const move = (ev: MouseEvent) => {
      const maxW = Math.max(240, innerWidth - this.x() - 8);
      const maxH = Math.max(140, innerHeight - this.y() - 8);
      this.w.set(Math.min(maxW, Math.max(240, ow + ev.clientX - startX)));
      this.h.set(Math.min(maxH, Math.max(140, oh + ev.clientY - startY)));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}
