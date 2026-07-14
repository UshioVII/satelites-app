import { Routes } from '@angular/router';
import { Globe } from './globe/globe';

export const routes: Routes = [
  { path: 'globe', component: Globe },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register').then((m) => m.Register) },
  { path: '', pathMatch: 'full', redirectTo: 'globe' },
];
