import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
  });

  it('renderiza img para un avatar subido', () => {
    const fixture = TestBed.createComponent(Avatar);
    const url = '/api/avatar/0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f';
    fixture.componentRef.setInput('avatar', url);
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe(url);
  });

  it('renderiza un planeta (imagen real) para un preset', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', 'preset:mars');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('.planet img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('planets/mars.jpg');
  });

  it('la Tierra usa el gif', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', 'preset:earth');
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('.planet img');
    expect(img!.getAttribute('src')).toBe('planets/earth.gif');
  });
});
