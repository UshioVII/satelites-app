import { Component, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  private el: ElementRef<HTMLElement> = inject(ElementRef);
  private io?: IntersectionObserver;

  constructor() {
    afterNextRender(() => this.initReveal());
  }

  scrollToQueEs() {
    document.getElementById('que-es')?.scrollIntoView({ behavior: 'smooth' });
  }

  private initReveal() {
    const targets = this.el.nativeElement.querySelectorAll<HTMLElement>('.reveal');
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      targets.forEach((t) => t.classList.add('in'));
      return;
    }
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            this.io!.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    targets.forEach((t) => this.io!.observe(t));
  }

  ngOnDestroy() {
    this.io?.disconnect();
  }
}
