import { Injectable, signal } from '@angular/core';

// Sonidos de feedback UI sintetizados con Web Audio (sin archivos de audio).
// Se desactiva solo si no hay AudioContext (jsdom en tests) o el usuario lo silencia.
@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private _enabled = signal(localStorage.getItem('sfx') !== 'off');
  readonly enabled = this._enabled.asReadonly();

  toggle() {
    const v = !this._enabled();
    this._enabled.set(v);
    localStorage.setItem('sfx', v ? 'on' : 'off');
    if (v) this.click(); // feedback al activar
  }

  private ac(): AudioContext | null {
    if (!this._enabled()) return null;
    const Ctor = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!Ctor) return null; // jsdom / sin Web Audio
    if (!this.ctx) { try { this.ctx = new Ctor(); } catch { return null; } }
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    return this.ctx;
  }

  // Un blip suave: oscilador con envolvente rápida (ataque corto, cola exponencial).
  private blip(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.05, delay = 0) {
    const ac = this.ac();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  click()   { this.blip(520, 0.06, 'triangle', 0.045); }
  open()    { this.blip(420, 0.10, 'sine', 0.05); this.blip(640, 0.10, 'sine', 0.04, 0.05); } // sube
  close()   { this.blip(520, 0.10, 'sine', 0.045); this.blip(340, 0.12, 'sine', 0.045, 0.045); } // baja
  success() { this.blip(660, 0.09, 'sine', 0.05); this.blip(880, 0.13, 'sine', 0.05, 0.07); }
  error()   { this.blip(300, 0.18, 'sawtooth', 0.045); }
}
