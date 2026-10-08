import { useEffect, useState } from 'react';
import { EVENTO_AVISOS, estadoAvisos, type EstadoAvisos } from '../lib/push';

/** Estado dos avisos do celular, atualizado ao ligar e ao voltar para o app. */
export function useEstadoAvisos(): EstadoAvisos {
  const [estado, setEstado] = useState<EstadoAvisos>(estadoAvisos);
  useEffect(() => {
    const atualizar = () => setEstado(estadoAvisos());
    window.addEventListener(EVENTO_AVISOS, atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.removeEventListener(EVENTO_AVISOS, atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);
  return estado;
}
