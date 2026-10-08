import type { TipoAlerta } from '../api/tipos';

export const TIPOS: TipoAlerta[] = ['blitz', 'radar', 'bloqueio', 'acidente'];

export const NOME_TIPO: Record<TipoAlerta, string> = {
  blitz: 'Blitz',
  radar: 'Radar móvel',
  bloqueio: 'Bloqueio',
  acidente: 'Acidente',
};

/** Detalhes opcionais que o relato pode levar: o contexto que hoje só existe no grupo de WhatsApp. */
export const DETALHES_POR_TIPO: Record<TipoAlerta, string[]> = {
  blitz: ['Só moto', 'Com guincho', 'Bafômetro'],
  radar: ['No canteiro', 'Em viatura'],
  bloqueio: ['Via toda fechada', 'Meia pista'],
  acidente: ['Pista bloqueada', 'No acostamento'],
};
