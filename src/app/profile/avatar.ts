import { Component, computed, input } from '@angular/core';

export const PRESETS = ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'moon'] as const;

@Component({
  selector: 'app-avatar',
  imports: [],
  template: `
    @if (isUpload()) {
      <img [src]="avatar()" alt="avatar" class="av" />
    } @else {
      <span class="av planet"><img [src]="presetSrc()" [alt]="presetId()" /></span>
    }
  `,
  styleUrl: './avatar.css',
})
export class Avatar {
  readonly avatar = input.required<string>();
  // Todo lo que no es un preset es una imagen subida (hoy /api/avatar/<uuid>). Se mira por
  // lo que NO es, así un cambio de ruta en el backend no vuelve a romper esto.
  readonly isUpload = computed(() => !this.avatar().startsWith('preset:'));
  readonly presetId = computed(() => this.avatar().replace('preset:', '') || 'earth');
  // La Tierra usa un GIF rotando; los demás planetas, imágenes reales. Assets en public/planets/.
  readonly presetSrc = computed(() => {
    const id = this.presetId();
    return 'planets/' + id + (id === 'earth' ? '.gif' : '.jpg');
  });
}
