import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'globe', loadComponent: () => import('./globe/globe').then((m) => m.Globe) },
  { path: 'map', loadComponent: () => import('./mapbox/mapbox-map').then((m) => m.MapboxMap) },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register').then((m) => m.Register) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./profile/profile').then((m) => m.Profile) },
  { path: 'stats', canActivate: [authGuard], loadComponent: () => import('./stats/stats').then((m) => m.Stats) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home').then((m) => m.Home) },
];
