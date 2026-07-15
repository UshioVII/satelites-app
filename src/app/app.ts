import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { WindowsService } from './ui/windows.service';
import { Window } from './ui/window';
import { Profile } from './profile/profile';
import { Stats } from './stats/stats';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Window, Profile, Stats],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  protected win = inject(WindowsService);
}
