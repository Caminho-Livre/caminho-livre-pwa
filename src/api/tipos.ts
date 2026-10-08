// Tipos que trafegam entre o app e a API. São os mesmos para o mock e para o
// backend real: quando a API HTTP existir, ela devolve exatamente isto.

export interface LatLng {
  lat: number;
  lng: number;
}

export type TipoAlerta = 'blitz' | 'radar' | 'bloqueio' | 'acidente';

export type StatusAlerta = 'ativo' | 'expirado' | 'derrubado';

export interface Usuario {
  id: string;
  /** Só existe no login por código. */
  telefone: string | null;
  /** Conta de teste criada sem cadastro (login anônimo do Supabase). */
  anonimo: boolean;
  criadoEm: string;
}

export interface Lugar {
  id: string;
  nome: string;
  posicao: LatLng;
}

export interface OpcaoRota {
  id: string;
  nome: string;
  rota: LatLng[];
  distanciaKm: number;
}

export interface Trajeto {
  id: string;
  usuarioId: string;
  nome: string;
  origem: Lugar;
  destino: Lugar;
  rota: LatLng[];
  distanciaKm: number;
  /** 0 = domingo … 6 = sábado (mesma convenção de Date.getDay). */
  diasSemana: number[];
  /** "HH:MM" */
  horaInicio: string;
  /** "HH:MM" */
  horaFim: string;
  /** Fuso de quem criou; a janela de horário vale na hora local dele. */
  fuso?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface NovoTrajeto {
  nome: string;
  origem: Lugar;
  destino: Lugar;
  rota: LatLng[];
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
  fuso?: string;
}

export interface Relato {
  id: string;
  usuarioId: string;
  alertaId: string;
  tipo: TipoAlerta;
  posicao: LatLng;
  detalhes: string[];
  criadoEm: string;
}

export interface NovoRelato {
  tipo: TipoAlerta;
  posicao: LatLng;
  detalhes: string[];
  /** Texto do local ("Perto de …") já calculado pelo app. */
  descricaoLocal?: string;
}

/** Agregado de relatos do mesmo tipo, próximos no espaço e no tempo. */
export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  posicao: LatLng;
  descricaoLocal: string;
  detalhes: string[];
  /** Quantas pessoas diferentes relataram. */
  relatos: number;
  confirmacoes: number;
  negativas: number;
  status: StatusAlerta;
  criadoEm: string;
  atualizadoEm: string;
  expiraEm: string;
}

export interface AlertaNoCaminho {
  alerta: Alerta;
  trajetoId: string;
  trajetoNome: string;
  distanciaM: number;
}

/** Área de interesse: o app só pede alertas e atividade dentro dela. */
export interface Regiao {
  centro: LatLng;
  raioKm: number;
}

export interface Atividade {
  relatosUltimaHora: number;
}

/** O que chega por push quando um alerta cai num trajeto do usuário. */
export interface PushAlerta {
  alertaId: string;
  titulo: string;
  corpo: string;
  url: string;
  /** O service worker já mostrou a notificação do sistema. */
  jaNotificado?: boolean;
}

export interface AssinaturaPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}
