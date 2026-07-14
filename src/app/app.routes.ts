import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'globe', loadComponent: () => import('./globe/globe').then((m) => m.Globe) },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register').then((m) => m.Register) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home').then((m) => m.Home) },
];
