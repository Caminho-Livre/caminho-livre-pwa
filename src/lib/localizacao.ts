import { ehMock, ferramentasDeTeste } from '../api';
import type { LatLng, LeituraGps } from '../api/tipos';

const CHAVE = 'caminho-livre:posicao';

export type ModoPosicao = 'simulada' | 'gps';

/**
 * No modo mock a posição simulada vem ligada: quem testa fora do DF cairia com
 * os relatos em outra cidade. Dá para trocar para o GPS real na tela Conta.
 */
export function modoPosicao(): ModoPosicao {
  if (!ehMock) return 'gps';
  try {
    return localStorage.getItem(CHAVE) === 'gps' ? 'gps' : 'simulada';
  } catch {
    return 'simulada';
  }
}

export function definirModoPosicao(modo: ModoPosicao): void {
  try {
    localStorage.setItem(CHAVE, modo);
  } catch {
    // Storage bloqueado: fica no padrão.
  }
}

export interface PosicaoObtida {
  posicao: LatLng;
  simulada: boolean;
  gps?: LeituraGps;
}

function numeroOuNulo(valor: number | null | undefined): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function obterPosicao(): Promise<PosicaoObtida> {
  if (modoPosicao() === 'simulada') {
    return Promise.resolve({ posicao: ferramentasDeTeste.posicaoSimulada(), simulada: true });
  }
  return new Promise((resolver, rejeitar) => {
    if (!('geolocation' in navigator)) {
      rejeitar(new Error('Este navegador não informa a localização.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolver({
          posicao: { lat: p.coords.latitude, lng: p.coords.longitude },
          simulada: false,
          gps: {
            precisaoM: numeroOuNulo(p.coords.accuracy),
            direcaoGraus: numeroOuNulo(p.coords.heading),
            velocidadeMs: numeroOuNulo(p.coords.speed),
          },
        }),
      (erro) =>
        rejeitar(
          new Error(
            erro.code === erro.PERMISSION_DENIED
              ? 'Permita o acesso à localização para reportar.'
              : 'Não consegui obter sua localização. Tente de novo.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 },
    );
  });
}
