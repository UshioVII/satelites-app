import { Component, computed, input } from '@angular/core';

export const PRESETS = ['earth', 'mars', 'jupiter', 'saturn', 'neptune', 'moon'] as const;

@Component({
  selector: 'app-avatar',
  imports: [],
  template: `
    @if (isUpload()) {
      <img [src]="avatar()" alt="avatar" class="av" />
    } @else {
      <span class="av planet planet-{{ presetId() }}"></span>
    }
  `,
  styleUrl: './avatar.css',
})
export class Avatar {
  readonly avatar = input.required<string>();
  readonly isUpload = computed(() => this.avatar().startsWith('/media'));
  readonly presetId = computed(() => this.avatar().replace('preset:', '') || 'earth');
}
