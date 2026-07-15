import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

// Medidor vertical: verde arriba (alto/cerca), amarillo medio, rojo abajo (bajo/lejos).
// La marca indica el valor actual (elevación 0–90°).
@Component({
  selector: 'app-proximity-gauge',
  template: `
    <div class="gauge">
      <div class="scale">
        <div class="zone green"></div><div class="zone yellow"></div><div class="zone red"></div>
        <div class="marker" [style.bottom.%]="pct()"></div>
      </div>
      <div class="gval">{{ value() | number: '1.0-0' }}°</div>
      @if (label()) { <div class="glabel">{{ label() }}</div> }
    </div>
  `,
  styles: [`
    .gauge { display: flex; flex-direction: column; align-items: center; gap: .4rem; }
    .scale { position: relative; width: 26px; height: 96px; border: 2px solid rgba(233,242,255,0.85);
      box-shadow: 0 0 14px -4px rgba(0,229,255,0.5); display: flex; flex-direction: column; }
    .zone { flex: 1; } .zone.green { background: var(--close); } .zone.yellow { background: var(--near); } .zone.red { background: var(--far); }
    .marker { position: absolute; left: -4px; right: -4px; height: 3px; background: #fff; box-shadow: 0 0 8px #fff; }
    .marker::after { content: ""; position: absolute; right: -8px; top: -3px; border: 4px solid transparent; border-right-color: #fff; }
    .gval { font-family: var(--mono); font-weight: 700; font-variant-numeric: tabular-nums; font-size: .85rem; }
    .glabel { font-family: var(--mono); font-size: .68rem; color: var(--ink-3); max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
  imports: [DecimalPipe],
})
export class ProximityGauge {
  readonly value = input.required<number>();
  readonly label = input('');
  readonly pct = computed(() => Math.max(0, Math.min(100, (this.value() / 90) * 100)));
}
