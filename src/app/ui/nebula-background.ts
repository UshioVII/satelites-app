import { Component, ElementRef, OnDestroy, OnInit, viewChild } from '@angular/core';

// Fondo ambiente: starfield en canvas + blobs de nebulosa CSS a la deriva.
// Fijo detrás del contenido (z-index 0). Respeta prefers-reduced-motion.
@Component({
  selector: 'app-nebula-background',
  template: `
    <canvas #cv class="stars"></canvas>
    <div class="nebula" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 0; pointer-events: none; display: block; }
    .stars { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .nebula { position: absolute; inset: -20% -10% -10% -10%; filter: blur(60px); opacity: 0.5; }
    .nebula span { position: absolute; border-radius: 50%; mix-blend-mode: screen; animation: drift 26s ease-in-out infinite alternate; }
    .b1 { width: 46vw; height: 46vw; left: -6vw; top: -8vw; background: radial-gradient(circle, rgba(0,229,255,0.5), transparent 65%); }
    .b2 { width: 52vw; height: 52vw; right: -12vw; top: 8vh; background: radial-gradient(circle, rgba(124,58,237,0.55), transparent 62%); animation-delay: -8s; }
    .b3 { width: 40vw; height: 40vw; left: 22vw; bottom: -18vw; background: radial-gradient(circle, rgba(79,70,229,0.5), transparent 60%); animation-delay: -14s; }
    @keyframes drift { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(4vw,-3vh,0) scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .nebula span { animation: none; } }
  `],
})
export class NebulaBackground implements OnInit, OnDestroy {
  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private raf = 0;
  private stars: { x: number; y: number; r: number; a: number; s: number; tw: number }[] = [];
  private w = 0; private h = 0; private dpr = Math.min(devicePixelRatio || 1, 2);
  private onResize = () => this.resize();

  ngOnInit() {
    this.resize();
    addEventListener('resize', this.onResize);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.frame();
    else this.draw(); // un frame estático
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); }

  private resize() {
    const c = this.cv().nativeElement;
    this.w = c.width = innerWidth * this.dpr; this.h = c.height = innerHeight * this.dpr;
    const n = Math.min(220, Math.floor((innerWidth * innerHeight) / 9000));
    this.stars = Array.from({ length: n }, () => ({
      x: Math.random() * this.w, y: Math.random() * this.h, r: (Math.random() * 1.3 + 0.2) * this.dpr,
      a: Math.random(), s: Math.random() * 0.02 + 0.004, tw: Math.random() < 0.5 ? 1 : -1,
    }));
  }
  private draw() {
    const x = this.cv().nativeElement.getContext('2d')!;
    x.clearRect(0, 0, this.w, this.h);
    for (const st of this.stars) {
      st.a += st.s * st.tw; if (st.a > 1 || st.a < 0.1) st.tw *= -1;
      x.beginPath(); x.arc(st.x, st.y, st.r, 0, 7);
      x.fillStyle = (st.r > 1.6 * this.dpr ? 'rgba(170,150,255,' : 'rgba(220,240,255,') + st.a + ')';
      x.fill();
    }
  }
  private frame = () => { this.draw(); this.raf = requestAnimationFrame(this.frame); };
}
