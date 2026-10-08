import type { Lugar } from '../tipos';

// Lugares do DF para o mock de busca. As coordenadas são aproximadas, só para
// o teste; o backend real troca isto por um serviço de geocoding.
export const LUGARES: Lugar[] = [
  { id: 'aguas-claras', nome: 'Águas Claras', posicao: { lat: -15.834, lng: -48.026 } },
  { id: 'taguatinga', nome: 'Taguatinga Centro', posicao: { lat: -15.833, lng: -48.056 } },
  { id: 'ceilandia', nome: 'Ceilândia Centro', posicao: { lat: -15.819, lng: -48.108 } },
  { id: 'samambaia', nome: 'Samambaia', posicao: { lat: -15.876, lng: -48.088 } },
  { id: 'vicente-pires', nome: 'Vicente Pires', posicao: { lat: -15.803, lng: -48.03 } },
  { id: 'guara', nome: 'Guará', posicao: { lat: -15.825, lng: -47.98 } },
  { id: 'sia', nome: 'SIA', posicao: { lat: -15.805, lng: -47.955 } },
  { id: 'sudoeste', nome: 'Sudoeste', posicao: { lat: -15.798, lng: -47.925 } },
  { id: 'asa-sul', nome: 'Asa Sul', posicao: { lat: -15.813, lng: -47.9 } },
  { id: 'scs', nome: 'Setor Comercial Sul', posicao: { lat: -15.797, lng: -47.889 } },
  { id: 'rodoviaria', nome: 'Rodoviária do Plano Piloto', posicao: { lat: -15.794, lng: -47.883 } },
  { id: 'asa-norte', nome: 'Asa Norte', posicao: { lat: -15.763, lng: -47.87 } },
  { id: 'lago-sul', nome: 'Lago Sul', posicao: { lat: -15.84, lng: -47.875 } },
  { id: 'aeroporto', nome: 'Aeroporto JK', posicao: { lat: -15.869, lng: -47.921 } },
  { id: 'sobradinho', nome: 'Sobradinho', posicao: { lat: -15.652, lng: -47.79 } },
  { id: 'planaltina', nome: 'Planaltina', posicao: { lat: -15.62, lng: -47.65 } },
  { id: 'gama', nome: 'Gama', posicao: { lat: -16.017, lng: -48.065 } },
];

export const lugar = (id: string): Lugar => {
  const achado = LUGARES.find((l) => l.id === id);
  if (!achado) throw new Error(`Lugar desconhecido: ${id}`);
  return achado;
};
