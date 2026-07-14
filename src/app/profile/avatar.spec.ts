import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
  });

  it('renderiza img para un avatar subido (/media)', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', '/media/x.png');
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/media/x.png');
  });

  it('renderiza un círculo-planeta para un preset', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('avatar', 'preset:mars');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.planet-mars')).toBeTruthy();
  });
});
