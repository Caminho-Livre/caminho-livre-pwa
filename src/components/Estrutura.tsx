import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';

const ABAS: { para: string; rotulo: string; icone: NomeIcone; exata?: boolean }[] = [
  { para: '/', rotulo: 'Mapa', icone: 'mapa', exata: true },
  { para: '/trajetos', rotulo: 'Trajetos', icone: 'trajetos' },
  { para: '/conta', rotulo: 'Conta', icone: 'conta' },
];

export function BarraAbas() {
  return (
    <nav className="abas" aria-label="Principal">
      {ABAS.map((aba) => (
        <NavLink key={aba.para} to={aba.para} end={aba.exata} className="aba">
          <Icone nome={aba.icone} />
          <span>{aba.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Cabecalho({
  titulo,
  voltarPara,
  rotuloVoltar,
  sobretitulo,
}: {
  titulo?: string;
  voltarPara: string;
  rotuloVoltar: string;
  sobretitulo?: string;
}) {
  return (
    <header className="cabecalho">
      <Link to={voltarPara} className="cabecalho__voltar" aria-label={rotuloVoltar}>
        <Icone nome="voltar" espessura={2.2} />
      </Link>
      {sobretitulo ? <span className="sobretitulo">{sobretitulo}</span> : null}
      {titulo ? <h1 className="cabecalho__titulo">{titulo}</h1> : null}
    </header>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p className="carregando" role="status">
      {texto}
    </p>
  );
}

export function Erro({ children }: { children: ReactNode }) {
  return (
    <p className="erro" role="alert">
      {children}
    </p>
  );
}
