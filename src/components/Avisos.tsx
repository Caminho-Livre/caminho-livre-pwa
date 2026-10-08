import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Avisos curtos no topo da tela ("Relato enviado", push recebido com o app
// aberto). Qualquer módulo chama avisar(); o componente <Avisos /> desenha.

export interface Aviso {
  id: number;
  titulo: string;
  texto?: string;
  /** Rota para abrir ao tocar. */
  para?: string;
  tom?: 'neutro' | 'alerta';
}

type Ouvinte = (avisos: Aviso[]) => void;

let fila: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<Ouvinte>();

const publicar = () => {
  for (const ouvinte of [...ouvintes]) ouvinte(fila);
};

export function avisar(aviso: Omit<Aviso, 'id'>, duracaoMs = 3500): void {
  const novo = { ...aviso, id: proximoId++ };
  fila = [...fila, novo].slice(-3);
  publicar();
  window.setTimeout(() => fechar(novo.id), duracaoMs);
}

function fechar(id: number): void {
  fila = fila.filter((a) => a.id !== id);
  publicar();
}

export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>(fila);
  const navegar = useNavigate();

  useEffect(() => {
    ouvintes.add(setAvisos);
    return () => {
      ouvintes.delete(setAvisos);
    };
  }, []);

  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <button
          key={aviso.id}
          type="button"
          className={`aviso${aviso.tom === 'alerta' ? ' aviso--alerta' : ''}`}
          onClick={() => {
            fechar(aviso.id);
            if (aviso.para) navegar(aviso.para);
          }}
        >
          <strong>{aviso.titulo}</strong>
          {aviso.texto ? <span>{aviso.texto}</span> : null}
        </button>
      ))}
    </div>
  );
}
