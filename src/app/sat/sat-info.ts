import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { WikiService, WikiSummary } from './wiki.service';
import { NotesService } from './notes.service';
import { FavoritesService } from '../favorites/favorites.service';
import { AuthService } from '../auth/auth.service';
import { Pass } from '../satellites.service';

@Component({
  selector: 'app-sat-info',
  imports: [FormsModule, DatePipe],
  templateUrl: './sat-info.html',
  styleUrl: './sat-info.css',
})
export class SatInfo {
  private wiki = inject(WikiService);
  private notesApi = inject(NotesService);
  private favs = inject(FavoritesService);
  protected auth = inject(AuthService);

  readonly name = input.required<string>();
  readonly noradId = input.required<number>();
  // Próximos pases del satélite (calculados en Globe); solo presentación acá, sin lógica nueva.
  readonly passes = input<Pass[]>([]);
  readonly nextPass = computed<Pass | null>(() => this.passes()[0] ?? null);
  // Escala vertical del perfil NASA (campana fija, ver sat-info.html): 90° de elevación = escala 1.
  readonly peakScale = computed(() => Math.max(0, Math.min(1, (this.nextPass()?.maxElevation ?? 0) / 90)));

  readonly wikiState = signal<'loading' | 'ok' | 'none'>('loading');
  readonly summary = signal<WikiSummary | null>(null);
  readonly note = signal('');
  readonly favMsg = signal('');
  readonly noteMsg = signal('');

  constructor() {
    // Wikipedia: refetch cuando cambia el nombre.
    effect(() => {
      const n = this.name();
      this.wikiState.set('loading');
      this.summary.set(null);
      this.wiki.summary(n).subscribe((s) => {
        this.summary.set(s);
        this.wikiState.set(s ? 'ok' : 'none');
      });
    });
    // Notas: cargar la nota del usuario cuando cambia el satélite (solo con sesión).
    effect(() => {
      const id = this.noradId();
      this.note.set('');
      this.favMsg.set('');
      this.noteMsg.set('');
      if (this.auth.isLoggedIn()) {
        this.notesApi.get(id).subscribe((nt) => this.note.set(nt?.body ?? ''));
      }
    });
  }

  saveNote() {
    const body = this.note().trim();
    if (!body) return this.deleteNote(); // guardar vacío = borrar la nota
    this.notesApi.save(this.noradId(), body).subscribe({
      next: () => this.noteMsg.set('✓ Guardada'),
      error: () => this.noteMsg.set('No se pudo guardar'),
    });
  }

  deleteNote() {
    this.notesApi.remove(this.noradId()).subscribe({
      next: () => {
        this.note.set('');
        this.noteMsg.set('Nota borrada');
      },
      error: () => this.noteMsg.set('No se pudo borrar'),
    });
  }

  addFavorite() {
    this.favs.add(this.noradId(), this.name()).subscribe({
      next: () => this.favMsg.set('★ Guardado'),
      error: (e) => this.favMsg.set(e?.status === 409 ? 'Ya en favoritos' : 'No se pudo guardar'),
    });
  }
}
