import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { LatLng, TipoAlerta } from '../api/tipos';
import { NOME_TIPO } from '../lib/rotulos';
import { ICONE_DO_TIPO, svgDoIcone } from './Icone';

// Tiles públicos do OpenStreetMap: servem para desenvolvimento e teste. Para
// produção, contrate um provedor de tiles (ou hospede os seus) e troque aqui.
const URL_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CREDITO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CENTRO_DF: L.LatLngExpression = [-15.8, -47.95];

export interface RotaNoMapa {
  pontos: LatLng[];
  /** A rota escolhida (azul) ou uma alternativa (cinza tracejado). */
  estilo?: 'principal' | 'alternativa';
}

export interface PinoNoMapa {
  id: string;
  tipo: TipoAlerta;
  posicao: LatLng;
  /** Em cima de um trajeto do usuário. */
  noCaminho?: boolean;
}

interface Props {
  rotas?: RotaNoMapa[];
  pinos?: PinoNoMapa[];
  /** Posição do usuário. */
  posicao?: LatLng | null;
  aoTocarPino?: (id: string) => void;
  /** Mapa de enfeite, sem arrastar nem zoom (trechos pequenos nas telas). */
  estatico?: boolean;
  /** Espaço em px a deixar livre em cima e embaixo ao enquadrar. */
  folga?: { topo?: number; base?: number };
  rotulo: string;
  className?: string;
}

const paraLeaflet = (p: LatLng): L.LatLngTuple => [p.lat, p.lng];

export function Mapa({
  rotas = [],
  pinos = [],
  posicao = null,
  aoTocarPino,
  estatico = false,
  folga,
  rotulo,
  className,
}: Props) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);
  const ultimoEnquadramento = useRef('');
  const tocar = useRef(aoTocarPino);
  tocar.current = aoTocarPino;
  // As telas montam os arrays a cada render; redesenha só se o conteúdo mudou.
  const assinatura = JSON.stringify([rotas, pinos, posicao]);

  useEffect(() => {
    if (!elemento.current) return;
    const instancia = L.map(elemento.current, {
      center: CENTRO_DF,
      zoom: 11,
      zoomControl: false,
      dragging: !estatico,
      touchZoom: !estatico,
      scrollWheelZoom: !estatico,
      doubleClickZoom: !estatico,
      boxZoom: !estatico,
      keyboard: !estatico,
    });
    L.tileLayer(URL_TILES, { attribution: CREDITO, maxZoom: 19 }).addTo(instancia);
    instancia.attributionControl.setPrefix(false);
    camada.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;

    const observador = new ResizeObserver(() => instancia.invalidateSize());
    observador.observe(elemento.current);

    return () => {
      observador.disconnect();
      instancia.remove();
      mapa.current = null;
      camada.current = null;
      ultimoEnquadramento.current = '';
    };
  }, [estatico]);

  useEffect(() => {
    const instancia = mapa.current;
    const grupo = camada.current;
    if (!instancia || !grupo) return;
    grupo.clearLayers();

    // Alternativas por baixo, rota escolhida por cima.
    const ordenadas = [...rotas].sort(
      (a, b) => Number(a.estilo !== 'alternativa') - Number(b.estilo !== 'alternativa'),
    );
    for (const rota of ordenadas) {
      const pontos = rota.pontos.map(paraLeaflet);
      if (pontos.length < 2) continue;
      if (rota.estilo === 'alternativa') {
        L.polyline(pontos, { color: '#8E939A', weight: 4, dashArray: '2 9', interactive: false }).addTo(grupo);
        continue;
      }
      L.polyline(pontos, { color: '#0F2D4D', weight: 10, interactive: false }).addTo(grupo);
      L.polyline(pontos, { color: '#5AA9FF', weight: 5, interactive: false }).addTo(grupo);
      L.circleMarker(pontos[0], {
        radius: 7,
        color: '#5AA9FF',
        weight: 3,
        fillColor: '#15171A',
        fillOpacity: 1,
        interactive: false,
      }).addTo(grupo);
      L.circleMarker(pontos[pontos.length - 1], {
        radius: 8,
        color: '#15171A',
        weight: 3,
        fillColor: '#5AA9FF',
        fillOpacity: 1,
        interactive: false,
      }).addTo(grupo);
    }

    for (const pino of pinos) {
      const tamanho = pino.noCaminho ? 44 : 36;
      const icone = L.divIcon({
        className: '',
        html: `<span class="pino${pino.noCaminho ? ' pino--no-caminho' : ''}">${svgDoIcone(ICONE_DO_TIPO[pino.tipo], pino.noCaminho ? 24 : 18)}</span>`,
        iconSize: [tamanho, tamanho],
        iconAnchor: [tamanho / 2, tamanho / 2],
      });
      const marcador = L.marker(paraLeaflet(pino.posicao), {
        icon: icone,
        title: `${NOME_TIPO[pino.tipo]}${pino.noCaminho ? ' no seu caminho' : ''}`,
        alt: NOME_TIPO[pino.tipo],
        keyboard: !estatico,
        interactive: !estatico,
        zIndexOffset: pino.noCaminho ? 500 : 0,
      }).addTo(grupo);
      marcador.on('click', () => tocar.current?.(pino.id));
    }

    if (posicao) {
      L.marker(paraLeaflet(posicao), {
        icon: L.divIcon({
          className: '',
          html: '<span class="pino-voce"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(grupo);
    }

    // Enquadra só quando o conteúdo principal muda, para não brigar com quem
    // está arrastando o mapa enquanto os alertas atualizam.
    const principais = rotas.filter((r) => r.estilo !== 'alternativa');
    const pontosDeEnquadre: LatLng[] =
      rotas.length > 0
        ? rotas.flatMap((r) => r.pontos)
        : posicao
          ? [posicao]
          : pinos.map((p) => p.posicao);
    const chave = JSON.stringify([
      principais.map((r) => [r.pontos[0], r.pontos[r.pontos.length - 1], r.pontos.length]),
      rotas.length,
      rotas.length === 0 && posicao ? [posicao.lat.toFixed(4), posicao.lng.toFixed(4)] : null,
      rotas.length === 0 && !posicao ? pinos.length : null,
    ]);
    if (chave !== ultimoEnquadramento.current && pontosDeEnquadre.length > 0) {
      ultimoEnquadramento.current = chave;
      instancia.invalidateSize();
      if (pontosDeEnquadre.length === 1) {
        instancia.setView(paraLeaflet(pontosDeEnquadre[0]), 15, { animate: false });
      } else {
        instancia.fitBounds(L.latLngBounds(pontosDeEnquadre.map(paraLeaflet)), {
          paddingTopLeft: [28, (folga?.topo ?? 0) + 28],
          paddingBottomRight: [28, (folga?.base ?? 0) + 28],
          animate: false,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, estatico, folga?.topo, folga?.base]);

  return (
    <div
      ref={elemento}
      className={`mapa${estatico ? ' mapa--estatico' : ''}${className ? ` ${className}` : ''}`}
      role="application"
      aria-label={rotulo}
    />
  );
}
