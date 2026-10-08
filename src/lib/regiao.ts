import type { Regiao, Trajeto } from '../api/tipos';
import { CENTRO_PADRAO, RAIO_PADRAO_KM, comprimentoKm, pontoNaRota } from './geo';
import { trajetoValendo } from './tempo';

/**
 * Região que a tela inicial mostra: em volta do trajeto valendo agora (ou do
 * primeiro trajeto salvo); sem trajeto, o DF. Alertas fora dela não são
 * buscados, então um relato do outro lado do mundo não aparece no mapa.
 */
export function regiaoDoUsuario(trajetos: Trajeto[], agora: Date): Regiao {
  const base =
    trajetos.find((t) => trajetoValendo(t, agora)) ??
    trajetos.find((t) => t.ativo) ??
    trajetos[0];
  if (!base || base.rota.length === 0) return { centro: CENTRO_PADRAO, raioKm: RAIO_PADRAO_KM };
  return {
    centro: pontoNaRota(base.rota, 0.5),
    // Cobre o trajeto inteiro com folga, mesmo os longos.
    raioKm: Math.max(RAIO_PADRAO_KM, Math.ceil(comprimentoKm(base.rota) / 2) + 10),
  };
}
