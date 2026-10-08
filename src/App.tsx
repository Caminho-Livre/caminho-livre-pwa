import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { Avisos, avisar } from './components/Avisos';
import { Carregando } from './components/Estrutura';
import { ProvedorSessao, useSessao } from './hooks/useSessao';
import { invalidar } from './lib/eventos';
import { notificarSistema } from './lib/notificacoes';
import { sincronizarPush } from './lib/push';
import Alerta from './pages/Alerta';
import Conta from './pages/Conta';
import Entrar from './pages/Entrar';
import Inicio from './pages/Inicio';
import NovoTrajeto from './pages/NovoTrajeto';
import Reportar from './pages/Reportar';
import Trajetos from './pages/Trajetos';

/** Telas que exigem login. */
function Protegidas() {
  const { usuario, carregando } = useSessao();
  const usuarioId = usuario?.id;
  // Com permissão já dada, garante que o servidor tem a assinatura deste aparelho.
  useEffect(() => {
    if (usuarioId) void sincronizarPush();
  }, [usuarioId]);
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/entrar" replace />;
  return <Outlet />;
}

function SoDeslogado() {
  const { usuario, carregando } = useSessao();
  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to="/" replace />;
  return <Entrar />;
}

/** Push recebido com o app aberto: aviso na tela, notificação do sistema e dados novos. */
function OuvintePush() {
  useEffect(
    () =>
      api.aoReceberPush((push) => {
        avisar({ titulo: push.titulo, texto: push.corpo, para: push.url, tom: 'alerta' }, 8000);
        if (!push.jaNotificado) void notificarSistema(push.titulo, push.corpo, push.url);
        invalidar();
      }),
    [],
  );
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <div className="app">
          <Avisos />
          <OuvintePush />
          <Routes>
            <Route path="/entrar" element={<SoDeslogado />} />
            <Route element={<Protegidas />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/reportar" element={<Reportar />} />
              <Route path="/alerta/:id" element={<Alerta />} />
              <Route path="/trajetos" element={<Trajetos />} />
              <Route path="/trajetos/novo" element={<NovoTrajeto />} />
              <Route path="/conta" element={<Conta />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ProvedorSessao>
    </BrowserRouter>
  );
}
