import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SatFocusService {
  private _focus = new Subject<number>(); // norad id
  readonly focus$ = this._focus.asObservable();
  focus(norad: number) {
    this._focus.next(norad);
  }
}
