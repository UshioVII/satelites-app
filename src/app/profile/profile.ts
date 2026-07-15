import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { FavoritesService, Favorite } from '../favorites/favorites.service';
import { SatellitesService, Sat, PosSat } from '../satellites.service';
import { Avatar, PRESETS } from './avatar';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, Avatar, DecimalPipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private fb = inject(FormBuilder);
  private favs = inject(FavoritesService);
  private sats = inject(SatellitesService);
  protected auth = inject(AuthService);

  readonly presets = PRESETS;
  readonly favorites = this.favs.items; // caché compartida con el globo
  readonly active = computed(() => this.favorites().filter((f) => !f.archived));
  readonly archived = computed(() => this.favorites().filter((f) => f.archived));
  readonly saved = signal(false);
  readonly uploadError = signal('');

  // TLEs cargados una vez (mapa norad -> Sat) para calcular la telemetría de cada favorito.
  private readonly tleByNorad = signal<Map<number, Sat> | null>(null);
  // norad -> posición/telemetría actual del favorito (snapshot al cargar el perfil).
  readonly favInfo = computed(() => {
    const tle = this.tleByNorad();
    const info = new Map<number, PosSat>();
    if (!tle) return info;
    const now = new Date();
    for (const f of this.active()) {
      const sat = tle.get(f.norad_id);
      if (!sat) continue;
      const p = this.sats.positionsAt([sat], now)[0];
      if (p) info.set(f.norad_id, p);
    }
    return info;
  });

  readonly form = this.fb.nonNullable.group({
    display_name: [this.auth.user()?.display_name ?? ''],
    home_lat: [this.auth.user()?.home_lat ?? (null as number | null)],
    home_lng: [this.auth.user()?.home_lng ?? (null as number | null)],
  });

  constructor() {
    this.favs.reload();
    // Cargamos los TLEs una vez para poder mostrar la telemetría de los favoritos.
    this.sats.loadTLEs('visual').subscribe(({ sats }) => {
      const m = new Map<number, Sat>();
      for (const s of sats) m.set(Number(s.satrec.satnum), s);
      this.tleByNorad.set(m);
    });
  }

  saveProfile() {
    this.auth.updateProfile(this.form.getRawValue()).subscribe(() => {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 1500);
    });
  }

  pickPreset(id: string) {
    this.auth.updateProfile({ avatar: `preset:${id}` }).subscribe();
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadError.set('');
    this.auth.uploadAvatar(file).subscribe({
      error: (e) => this.uploadError.set(e?.error?.error ?? 'No se pudo subir la imagen'),
    });
  }

  toggleArchive(f: Favorite) {
    this.favs.setArchived(f.id, !f.archived).subscribe();
  }

  removeFav(f: Favorite) {
    this.favs.remove(f.id).subscribe();
  }

  setColor(f: Favorite, color: string) {
    this.favs.setColor(f.id, color).subscribe();
  }
}
