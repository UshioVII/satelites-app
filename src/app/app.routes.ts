import { Routes } from '@angular/router';
import { Globe } from './globe/globe';

export const routes: Routes = [
  { path: 'globe', component: Globe },
  { path: '', pathMatch: 'full', redirectTo: 'globe' },
];
