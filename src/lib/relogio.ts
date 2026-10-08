// Relógio único do app. O mock e as telas leem a hora daqui, o que permite
// "adiantar o relógio" nas ferramentas de teste para ver alertas expirando.

let deslocamentoMs = 0;

export function agora(): Date {
  return new Date(Date.now() + deslocamentoMs);
}

export function adiantarRelogio(minutos: number): void {
  deslocamentoMs += minutos * 60_000;
}

export function zerarRelogio(): void {
  deslocamentoMs = 0;
}

export function minutosAdiantados(): number {
  return Math.round(deslocamentoMs / 60_000);
}
