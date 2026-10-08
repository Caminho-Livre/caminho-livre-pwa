import type { TipoAlerta } from '../api/tipos';

// O miolo de cada ícone fica como texto para ser reaproveitado nos pinos do
// mapa (o Leaflet recebe HTML, não componentes React).
export const DESENHOS = {
  blitz: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/>',
  radar:
    '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  bloqueio: '<path d="M3 9h18v6H3z"/><path d="M8 9l-3 6M13 9l-3 6M18 9l-3 6M6 15v5M18 15v5"/>',
  acidente: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  trajetos:
    '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/>',
  conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  avancar: '<path d="M9 5l7 7-7 7"/>',
  pino: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  sim: '<path d="M5 12l5 5 9-10"/>',
  nao: '<path d="M6 6l12 12M18 6L6 18"/>',
  lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  sino: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  // Ícone de "Compartilhar" do Safari: quadrado aberto com seta para cima.
  compartilhar: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 11H6v10h12V11h-2"/>',
  conversa: '<path d="M4 5h16v11H9l-5 4V5z"/>',
} as const;

export type NomeIcone = keyof typeof DESENHOS;

export const ICONE_DO_TIPO: Record<TipoAlerta, NomeIcone> = {
  blitz: 'blitz',
  radar: 'radar',
  bloqueio: 'bloqueio',
  acidente: 'acidente',
};

/** SVG completo como texto, para os pinos do mapa. */
export function svgDoIcone(nome: NomeIcone, tamanho = 24, espessura = 2.2): string {
  return `<svg viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DESENHOS[nome]}</svg>`;
}

export function Icone({
  nome,
  tamanho = 24,
  espessura = 2,
}: {
  nome: NomeIcone;
  tamanho?: number;
  espessura?: number;
}) {
  return (
    <svg
      className="icone"
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Conteúdo fixo deste arquivo, nunca texto de usuário.
      dangerouslySetInnerHTML={{ __html: DESENHOS[nome] }}
    />
  );
}
