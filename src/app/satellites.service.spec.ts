import { compass } from './satellites.service';

describe('compass', () => {
  it('mapea los 8 rumbos en sus centros', () => {
    expect(compass(0)).toBe('N');
    expect(compass(45)).toBe('NE');
    expect(compass(90)).toBe('E');
    expect(compass(135)).toBe('SE');
    expect(compass(180)).toBe('S');
    expect(compass(225)).toBe('SO');
    expect(compass(270)).toBe('O');
    expect(compass(315)).toBe('NO');
  });

  it('redondea al rumbo mas cercano', () => {
    expect(compass(22)).toBe('N'); // < 22.5
    expect(compass(23)).toBe('NE'); // > 22.5
  });

  it('envuelve 360 y negativos a N', () => {
    expect(compass(360)).toBe('N');
    expect(compass(359)).toBe('N'); // 359 -> ronda a 8 -> %8 = 0 = N
    expect(compass(-45)).toBe('NO');
  });
});
