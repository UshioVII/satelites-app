import { Injectable, signal } from '@angular/core';

export type Toast = { id: number; text: string; kind: 'ok' | 'error' };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _items = signal<Toast[]>([]);
  readonly items = this._items.asReadonly();
  private n = 0;

  show(text: string, kind: 'ok' | 'error' = 'ok') {
    const id = ++this.n;
    this._items.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), 3800);
  }

  dismiss(id: number) {
    this._items.update((t) => t.filter((x) => x.id !== id));
  }
}
