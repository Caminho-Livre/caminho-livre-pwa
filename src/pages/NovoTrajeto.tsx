import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ehMock } from '../api';
import type { Lugar, OpcaoRota } from '../api/tipos';
import { avisar } from '../components/Avisos';
import { Cabecalho, Erro } from '../components/Estrutura';
import { Mapa } from '../components/Mapa';
import { invalidar } from '../lib/eventos';
import { obterPosicao } from '../lib/localizacao';

// Semana começando na segunda. O valor é o de Date.getDay (0 = domingo).
const DIAS: { valor: number; letra: string; nome: string }[] = [
  { valor: 1, letra: 'S', nome: 'Segunda' },
  { valor: 2, letra: 'T', nome: 'Terça' },
  { valor: 3, letra: 'Q', nome: 'Quarta' },
  { valor: 4, letra: 'Q', nome: 'Quinta' },
  { valor: 5, letra: 'S', nome: 'Sexta' },
  { valor: 6, letra: 'S', nome: 'Sábado' },
  { valor: 0, letra: 'D', nome: 'Domingo' },
];

function SeletorLugar({
  id,
  rotulo,
  escolhido,
  aoEscolher,
}: {
  id: string;
  rotulo: string;
  escolhido: Lugar | null;
  aoEscolher: (lugar: Lugar | null) => void;
}) {
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setBuscando(true);
    try {
      await acao();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui buscar.');
    } finally {
      setBuscando(false);
    }
  }

  // A busca roda ao confirmar (Enter ou botão), não a cada tecla: o serviço
  // gratuito de endereços não permite busca enquanto se digita.
  function buscar(evento: FormEvent) {
    evento.preventDefault();
    void executar(async () => setSugestoes(await api.buscarLugares(texto)));
  }

  function usarMinhaPosicao() {
    void executar(async () => {
      const { posicao } = await obterPosicao();
      const descricao = await api.descreverLocal(posicao);
      aoEscolher({ id: `posicao-${id}`, nome: descricao.replace(/^Perto de /, ''), posicao });
      setSugestoes(null);
    });
  }

  if (escolhido) {
    return (
      <div className="seletor">
        <span className="rotulo">{rotulo}</span>
        <div className="seletor__escolhido">
          <span className="seletor__nome">{escolhido.nome}</span>
          <button
            type="button"
            className="botao-pequeno"
            onClick={() => {
              aoEscolher(null);
              setSugestoes(null);
            }}
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="seletor" role="search" onSubmit={buscar}>
      <label className="rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <div className="seletor__linha">
        <input
          id={id}
          className="campo"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Endereço, bairro ou lugar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="botao-pequeno" type="submit" disabled={buscando}>
          Buscar
        </button>
      </div>
      <button className="botao-texto botao-texto--esquerda" type="button" onClick={usarMinhaPosicao} disabled={buscando}>
        Usar minha localização
      </button>
      {erro ? <Erro>{erro}</Erro> : null}
      {buscando ? <p className="mudo">Buscando…</p> : null}
      {sugestoes ? (
        <ul className="sugestoes">
          {sugestoes.length === 0 ? (
            <li className="sugestoes__vazio">
              {texto.trim().length < 3 && !ehMock ? 'Digite pelo menos 3 letras.' : 'Nada encontrado com esse nome.'}
            </li>
          ) : null}
          {sugestoes.map((lugar) => (
            <li key={lugar.id}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(lugar);
                  setTexto('');
                  setSugestoes(null);
                }}
              >
                {lugar.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

export default function NovoTrajeto() {
  const navegar = useNavigate();
  const [origem, setOrigem] = useState<Lugar | null>(null);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoRota[]>([]);
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [horaFim, setHoraFim] = useState('09:00');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setOpcoes([]);
    setRotaId(null);
    if (!origem || !destino) return;
    let vivo = true;
    setErro(null);
    api
      .calcularRotas(origem, destino)
      .then((lista) => {
        if (!vivo) return;
        setOpcoes(lista);
        setRotaId(lista[0]?.id ?? null);
      })
      .catch((falha: unknown) => {
        if (vivo) setErro(falha instanceof Error ? falha.message : 'Não consegui calcular a rota.');
      });
    return () => {
      vivo = false;
    };
  }, [origem, destino]);

  const escolhida = opcoes.find((o) => o.id === rotaId) ?? null;
  const nomeSugerido = origem && destino ? `${origem.nome} → ${destino.nome}` : '';

  async function salvar() {
    if (!origem || !destino || !escolhida) return;
    setErro(null);
    setSalvando(true);
    try {
      await api.criarTrajeto({
        nome: nome.trim() || nomeSugerido,
        origem,
        destino,
        rota: escolhida.rota,
        diasSemana: dias,
        horaInicio,
        horaFim,
        fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      invalidar();
      avisar({ titulo: 'Trajeto salvo', texto: 'Os avisos deste caminho já estão ligados.' });
      navegar('/trajetos', { replace: true });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui salvar.');
      setSalvando(false);
    }
  }

  return (
    <main className="tela">
      <div className="tela__rolagem">
        <Cabecalho titulo="Novo trajeto" voltarPara="/trajetos" rotuloVoltar="Voltar aos trajetos" />

        <SeletorLugar id="origem" rotulo="Origem" escolhido={origem} aoEscolher={setOrigem} />
        <SeletorLugar id="destino" rotulo="Destino" escolhido={destino} aoEscolher={setDestino} />

        {opcoes.length > 0 ? (
          <>
            <h2 className="secao">Qual caminho você faz?</h2>
            <div className="mapa-trecho mapa-trecho--alto">
              <Mapa
                rotulo="Opções de caminho"
                rotas={opcoes.map((o) => ({
                  pontos: o.rota,
                  estilo: o.id === rotaId ? 'principal' : 'alternativa',
                }))}
                estatico
              />
            </div>
            <div className="grade-2">
              {opcoes.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  className="opcao"
                  aria-pressed={opcao.id === rotaId}
                  onClick={() => setRotaId(opcao.id)}
                >
                  <span className="opcao__nome">{opcao.nome}</span>
                  <span className="mudo">{String(opcao.distanciaKm).replace('.', ',')} km</span>
                </button>
              ))}
            </div>

            <label className="rotulo" htmlFor="nome">
              Nome do trajeto
            </label>
            <input
              id="nome"
              className="campo"
              type="text"
              placeholder={nomeSugerido}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </>
        ) : null}

        <h2 className="secao">Em que dias?</h2>
        <div className="dias">
          {DIAS.map((dia) => (
            <button
              key={dia.valor}
              type="button"
              className="dia"
              aria-label={dia.nome}
              aria-pressed={dias.includes(dia.valor)}
              onClick={() =>
                setDias((atuais) =>
                  atuais.includes(dia.valor)
                    ? atuais.filter((d) => d !== dia.valor)
                    : [...atuais, dia.valor],
                )
              }
            >
              {dia.letra}
            </button>
          ))}
        </div>

        <h2 className="secao">Em que horário?</h2>
        <div className="grade-2">
          <label className="campo campo--hora">
            <span className="mudo">Das</span>
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </label>
          <label className="campo campo--hora">
            <span className="mudo">Até</span>
            <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </label>
        </div>

        <div className="espaco" />

        {erro ? <Erro>{erro}</Erro> : null}

        <button
          className="botao"
          type="button"
          disabled={!escolhida || dias.length === 0 || !horaInicio || !horaFim || salvando}
          onClick={salvar}
        >
          Salvar trajeto
        </button>
      </div>
    </main>
  );
}
