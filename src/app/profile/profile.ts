import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { FavoritesService, Favorite } from '../favorites/favorites.service';
import { Avatar, PRESETS } from './avatar';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, Avatar],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private fb = inject(FormBuilder);
  private favs = inject(FavoritesService);
  protected auth = inject(AuthService);

  readonly presets = PRESETS;
  readonly favorites = signal<Favorite[]>([]);
  readonly active = computed(() => this.favorites().filter((f) => !f.archived));
  readonly archived = computed(() => this.favorites().filter((f) => f.archived));
  readonly saved = signal(false);
  readonly uploadError = signal('');

  readonly form = this.fb.nonNullable.group({
    display_name: [this.auth.user()?.display_name ?? ''],
    home_lat: [this.auth.user()?.home_lat ?? (null as number | null)],
    home_lng: [this.auth.user()?.home_lng ?? (null as number | null)],
  });

  constructor() {
    this.reload();
  }

  reload() {
    this.favs.list().subscribe((f) => this.favorites.set(f));
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
    this.favs.setArchived(f.id, !f.archived).subscribe(() => this.reload());
  }

  removeFav(f: Favorite) {
    this.favs.remove(f.id).subscribe(() => this.reload());
  }
}
