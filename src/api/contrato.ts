import type {
  Alerta,
  AlertaNoCaminho,
  Atividade,
  LatLng,
  Lugar,
  NovoRelato,
  AssinaturaPush,
  NovoTrajeto,
  OpcaoRota,
  PushAlerta,
  Regiao,
  Relato,
  Trajeto,
  Usuario,
} from './tipos';

/**
 * Contrato único entre as telas e o backend.
 *
 * Hoje a única implementação é o mock (src/api/mock). Para ligar no backend
 * real, crie outra implementação desta interface (fetch para a API Spring) e
 * troque a exportação em src/api/index.ts. Nenhuma tela importa o mock direto.
 */
export interface Api {
  // --- Sessão ---------------------------------------------------------
  /**
   * Como se entra: por código (SMS) ou sem cadastro (conta de teste anônima,
   * usada com o Supabase enquanto não há SMS).
   */
  readonly modoLogin: 'codigo' | 'anonimo';
  solicitarCodigo(telefone: string): Promise<void>;
  confirmarCodigo(telefone: string, codigo: string): Promise<Usuario>;
  entrarAnonimo(): Promise<Usuario>;
  usuarioAtual(): Promise<Usuario | null>;
  sair(): Promise<void>;

  // --- Lugares e rotas (no backend real: geocoding + OSRM) -------------
  buscarLugares(texto: string): Promise<Lugar[]>;
  descreverLocal(posicao: LatLng): Promise<string>;
  calcularRotas(origem: Lugar, destino: Lugar): Promise<OpcaoRota[]>;

  // --- Trajetos ---------------------------------------------------------
  listarTrajetos(): Promise<Trajeto[]>;
  criarTrajeto(dados: NovoTrajeto): Promise<Trajeto>;
  atualizarTrajeto(id: string, mudancas: { ativo: boolean }): Promise<Trajeto>;
  removerTrajeto(id: string): Promise<void>;

  // --- Alertas e relatos --------------------------------------------------
  /** Alertas visíveis dentro da região (nunca o mundo todo). */
  listarAlertas(regiao: Regiao): Promise<Alerta[]>;
  obterAlerta(id: string): Promise<Alerta | null>;
  /** Alertas que caem em algum trajeto do usuário que vale agora. */
  alertasNoCaminho(): Promise<AlertaNoCaminho[]>;
  criarRelato(dados: NovoRelato): Promise<{ relato: Relato; alerta: Alerta }>;
  /** Resposta ao "Ainda está lá?". */
  responderAlerta(id: string, aindaEsta: boolean): Promise<Alerta>;
  /** Relatos da última hora dentro da região. */
  atividadeRecente(regiao: Regiao): Promise<Atividade>;

  // --- Push ---------------------------------------------------------------
  /** Guarda a assinatura Web Push deste aparelho para o servidor poder avisar. */
  registrarAssinaturaPush(assinatura: AssinaturaPush): Promise<void>;
  /**
   * Registra um ouvinte para pushes recebidos com o app aberto e devolve a
   * função que cancela o registro. No backend real isso vira Web Push: o
   * service worker recebe o evento (public/sw-push.js) e repassa para a página.
   */
  aoReceberPush(ouvinte: (push: PushAlerta) => void): () => void;
}

export class ErroApi extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
  }
}
