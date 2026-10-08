import { useState } from 'react';
import { useEstadoAvisos } from '../hooks/useAvisos';
import { ativarPush, ehIphone, TEXTO_RESULTADO_PUSH, type EstadoAvisos } from '../lib/push';
import { avisar } from './Avisos';
import { Icone } from './Icone';

/** Passo a passo para pôr o app na Tela de Início do iPhone. */
export function PassosIphone() {
  return (
    <ol className="passos-iphone">
      <li>
        <span className="entrar__numero">1</span>
        <span>
          Toque em <strong>Compartilhar</strong>{' '}
          <span className="passos-iphone__icone" aria-label="ícone de compartilhar">
            <Icone nome="compartilhar" tamanho={18} />
          </span>{' '}
          na barra do Safari.
        </span>
      </li>
      <li>
        <span className="entrar__numero">2</span>
        <span>
          Escolha <strong>Adicionar à Tela de Início</strong>. Se não aparecer, role a lista para baixo.
        </span>
      </li>
      <li>
        <span className="entrar__numero">3</span>
        <span>
          Abra o <strong>Caminho Livre</strong> pelo ícone novo e comece por lá.
        </span>
      </li>
    </ol>
  );
}

function comoLiberar(): string {
  if (ehIphone()) return 'Abra Ajustes do iPhone → Notificações → Caminho Livre e ligue Permitir Notificações.';
  if (/Android/.test(navigator.userAgent)) {
    return 'No Chrome, toque nos três pontos → Informações (ⓘ) → Permissões e libere Notificações. Depois volte aqui.';
  }
  return 'Clique no ícone ao lado do endereço do site, libere Notificações e recarregue a página.';
}

const TITULO: Record<Exclude<EstadoAvisos, 'ligados'>, string> = {
  desligados: 'Ligue os avisos do celular',
  bloqueados: 'Avisos bloqueados neste celular',
  'instalar-iphone': 'Instale o app para receber avisos',
  'sem-suporte': 'Este navegador não mostra avisos',
};

const TEXTO: Record<Exclude<EstadoAvisos, 'ligados'>, string> = {
  desligados: 'Sem isso, o alerta no seu caminho só aparece com o app aberto.',
  bloqueados: 'Assim nenhum alerta chega com o app fechado.',
  'instalar-iphone': 'O iPhone só manda aviso de app adicionado à Tela de Início.',
  'sem-suporte': 'Abra o link no Chrome (Android) ou no Safari (iPhone).',
};

/**
 * Aparece enquanto os avisos do celular não estão ligados. É o que faz o
 * push chegar: sem ele, o app só mostra alertas com a tela aberta.
 */
export function LigarAvisos({ abertoDeInicio = false }: { abertoDeInicio?: boolean }) {
  const estado = useEstadoAvisos();
  const [aberto, setAberto] = useState(abertoDeInicio);
  const [ligando, setLigando] = useState(false);

  if (estado === 'ligados') return null;
  const temPassos = estado === 'instalar-iphone' || estado === 'bloqueados';

  async function ligar() {
    setLigando(true);
    const resultado = await ativarPush();
    setLigando(false);
    if (resultado === 'ativado') {
      avisar({ titulo: 'Avisos ligados', texto: 'Alerta no seu caminho chega mesmo com o app fechado.' });
    } else if (resultado !== 'negado') {
      avisar({ titulo: 'Os avisos não ligaram', texto: TEXTO_RESULTADO_PUSH[resultado] }, 6000);
    }
  }

  return (
    <section className="avisos-celular" aria-label="Avisos do celular">
      <div className="avisos-celular__linha">
        <span className="avisos-celular__icone">
          <Icone nome="sino" tamanho={22} />
        </span>
        <div className="cartao__texto">
          <span className="avisos-celular__titulo">{TITULO[estado]}</span>
          <span className="mudo">{TEXTO[estado]}</span>
        </div>
        {estado === 'desligados' ? (
          <button
            className="botao-pequeno botao-pequeno--destaque"
            type="button"
            disabled={ligando}
            onClick={() => void ligar()}
          >
            Ligar avisos
          </button>
        ) : temPassos ? (
          <button
            className="botao-pequeno"
            type="button"
            aria-expanded={aberto}
            onClick={() => setAberto(!aberto)}
          >
            {aberto ? 'Fechar' : 'Como fazer'}
          </button>
        ) : null}
      </div>

      {temPassos && aberto ? (
        estado === 'instalar-iphone' ? (
          <div className="avisos-celular__detalhe">
            <PassosIphone />
            <p className="mudo">
              O app instalado não leva o que está aqui no Safari: crie seus trajetos de novo por lá.
            </p>
          </div>
        ) : (
          <p className="avisos-celular__detalhe mudo">{comoLiberar()}</p>
        )
      ) : null}
    </section>
  );
}
