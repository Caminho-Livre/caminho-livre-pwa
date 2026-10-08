import type { LatLng } from '../api/tipos';

const RAIO_TERRA_M = 6_371_000;
const rad = (graus: number) => (graus * Math.PI) / 180;
const graus = (radianos: number) => (radianos * 180) / Math.PI;

/** Distância em metros entre dois pontos (haversine). */
export function distanciaM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Plano {
  x: number;
  y: number;
}

/** Projeção plana local em metros. Boa o suficiente para distâncias de cidade. */
function projetar(p: LatLng, ref: LatLng): Plano {
  return {
    x: rad(p.lng - ref.lng) * Math.cos(rad(ref.lat)) * RAIO_TERRA_M,
    y: rad(p.lat - ref.lat) * RAIO_TERRA_M,
  };
}

function desprojetar(p: Plano, ref: LatLng): LatLng {
  return {
    lat: ref.lat + graus(p.y / RAIO_TERRA_M),
    lng: ref.lng + graus(p.x / (RAIO_TERRA_M * Math.cos(rad(ref.lat)))),
  };
}

/** Distância em metros de um ponto ao segmento a–b. */
export function distanciaAteSegmentoM(p: LatLng, a: LatLng, b: LatLng): number {
  const pa = projetar(a, p);
  const pb = projetar(b, p);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const comprimento2 = dx * dx + dy * dy;
  if (comprimento2 === 0) return Math.hypot(pa.x, pa.y);
  // O ponto p é a origem do plano, então o vetor a→p é (-pa.x, -pa.y).
  const t = Math.max(0, Math.min(1, (-pa.x * dx - pa.y * dy) / comprimento2));
  return Math.hypot(pa.x + t * dx, pa.y + t * dy);
}

/**
 * Distância em metros de um ponto à rota (polilinha).
 * É o equivalente local do ST_DWithin que o backend vai rodar no PostGIS.
 */
export function distanciaAteRotaM(p: LatLng, rota: LatLng[]): number {
  if (rota.length === 0) return Infinity;
  if (rota.length === 1) return distanciaM(p, rota[0]);
  let menor = Infinity;
  for (let i = 0; i < rota.length - 1; i++) {
    menor = Math.min(menor, distanciaAteSegmentoM(p, rota[i], rota[i + 1]));
  }
  return menor;
}

export function comprimentoM(rota: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < rota.length - 1; i++) total += distanciaM(rota[i], rota[i + 1]);
  return total;
}

export function comprimentoKm(rota: LatLng[]): number {
  return Math.round(comprimentoM(rota) / 100) / 10;
}

/** Ponto a uma fração (0–1) do comprimento da rota. */
export function pontoNaRota(rota: LatLng[], fracao: number): LatLng {
  if (rota.length === 0) throw new Error('Rota vazia.');
  if (rota.length === 1) return rota[0];
  const alvo = Math.max(0, Math.min(1, fracao)) * comprimentoM(rota);
  let andado = 0;
  for (let i = 0; i < rota.length - 1; i++) {
    const trecho = distanciaM(rota[i], rota[i + 1]);
    if (andado + trecho >= alvo && trecho > 0) {
      const t = (alvo - andado) / trecho;
      return {
        lat: rota[i].lat + (rota[i + 1].lat - rota[i].lat) * t,
        lng: rota[i].lng + (rota[i + 1].lng - rota[i].lng) * t,
      };
    }
    andado += trecho;
  }
  return rota[rota.length - 1];
}

/**
 * Curva suave entre dois pontos (Bézier quadrática). `desvio` é a fração da
 * distância que a curva se afasta da linha reta; o sinal escolhe o lado.
 * Só o mock usa: é o substituto do roteador (OSRM) enquanto não há backend.
 */
export function curva(origem: LatLng, destino: LatLng, desvio: number, pontos = 48): LatLng[] {
  const b = projetar(destino, origem);
  const comprimento = Math.hypot(b.x, b.y);
  if (comprimento === 0) return [origem, destino];
  const controle: Plano = {
    x: b.x / 2 + (-b.y / comprimento) * desvio * comprimento,
    y: b.y / 2 + (b.x / comprimento) * desvio * comprimento,
  };
  const rota: LatLng[] = [];
  for (let i = 0; i <= pontos; i++) {
    const t = i / pontos;
    const u = 1 - t;
    rota.push(
      desprojetar(
        { x: 2 * u * t * controle.x + t * t * b.x, y: 2 * u * t * controle.y + t * t * b.y },
        origem,
      ),
    );
  }
  rota[0] = origem;
  rota[rota.length - 1] = destino;
  return rota;
}

/** Desloca um ponto alguns metros para leste (x) e norte (y). */
export function deslocar(p: LatLng, lesteM: number, norteM: number): LatLng {
  return desprojetar({ x: lesteM, y: norteM }, p);
}

/**
 * Tira pontos redundantes da rota (Douglas–Peucker) sem desviar mais que
 * `toleranciaM` metros do traçado original. Rotas do OSRM vêm com milhares de
 * pontos; com 5 m de tolerância o cruzamento de 80 m continua fiel.
 */
export function simplificar(rota: LatLng[], toleranciaM = 5): LatLng[] {
  if (rota.length <= 2) return rota;
  const manter = new Uint8Array(rota.length);
  manter[0] = 1;
  manter[rota.length - 1] = 1;
  const pilha: [number, number][] = [[0, rota.length - 1]];
  while (pilha.length > 0) {
    const [inicio, fim] = pilha.pop()!;
    let maior = 0;
    let indice = -1;
    for (let i = inicio + 1; i < fim; i++) {
      const d = distanciaAteSegmentoM(rota[i], rota[inicio], rota[fim]);
      if (d > maior) {
        maior = d;
        indice = i;
      }
    }
    if (indice !== -1 && maior > toleranciaM) {
      manter[indice] = 1;
      pilha.push([inicio, indice], [indice, fim]);
    }
  }
  return rota.filter((_, i) => manter[i] === 1);
}
