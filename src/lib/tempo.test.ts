import { describe, expect, it } from 'vitest';
import { dentroDaJanela, formatarHora, haQuanto, resumoDias, resumoJanela } from './tempo';

// 5 de outubro de 2026 é uma segunda-feira.
const segunda = (h: number, m = 0) => new Date(2026, 9, 5, h, m);
const terca = (h: number, m = 0) => new Date(2026, 9, 6, h, m);

describe('dentroDaJanela', () => {
  const uteis = [1, 2, 3, 4, 5];

  it('vale dentro do horário em dia marcado', () => {
    expect(dentroDaJanela(uteis, '07:00', '09:00', segunda(8))).toBe(true);
    expect(dentroDaJanela(uteis, '07:00', '09:00', segunda(7))).toBe(true);
    expect(dentroDaJanela(uteis, '07:00', '09:00', segunda(9))).toBe(true);
  });

  it('não vale fora do horário nem em dia não marcado', () => {
    expect(dentroDaJanela(uteis, '07:00', '09:00', segunda(9, 1))).toBe(false);
    expect(dentroDaJanela([6, 0], '07:00', '09:00', segunda(8))).toBe(false);
  });

  it('janela que cruza a meia-noite pertence ao dia em que começa', () => {
    expect(dentroDaJanela([1], '22:00', '02:00', segunda(23))).toBe(true);
    expect(dentroDaJanela([1], '22:00', '02:00', terca(1))).toBe(true);
    expect(dentroDaJanela([1], '22:00', '02:00', terca(23))).toBe(false);
    expect(dentroDaJanela([1], '22:00', '02:00', segunda(1))).toBe(false);
  });
});

describe('textos', () => {
  it('formata hora', () => {
    expect(formatarHora('07:00')).toBe('7h');
    expect(formatarHora('17:30')).toBe('17h30');
  });

  it('resume dias e janela', () => {
    expect(resumoDias([1, 2, 3, 4, 5])).toBe('seg a sex');
    expect(resumoDias([0, 1, 2, 3, 4, 5, 6])).toBe('todos os dias');
    expect(resumoDias([0, 6])).toBe('sáb e dom');
    expect(resumoDias([5, 1, 3])).toBe('seg, qua, sex');
    expect(resumoJanela('00:00', '23:59')).toBe('o dia todo');
    expect(resumoJanela('07:00', '09:00')).toBe('7h às 9h');
  });

  it('diz há quanto tempo', () => {
    const base = segunda(8);
    expect(haQuanto(new Date(base.getTime() - 20_000).toISOString(), base)).toBe('agora');
    expect(haQuanto(new Date(base.getTime() - 6 * 60_000).toISOString(), base)).toBe('há 6 min');
    expect(haQuanto(new Date(base.getTime() - 130 * 60_000).toISOString(), base)).toBe('há 2 h');
  });
});
