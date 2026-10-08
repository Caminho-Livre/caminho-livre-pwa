/* Carregado pelo service worker gerado (workbox importScripts).
   Recebe o Web Push enviado por api/notificar.ts, mostra a notificação e
   repassa o conteúdo para as abas abertas do app (aviso dentro do app).
   Payload esperado: { "alertaId", "titulo", "corpo", "url" }. */

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (_) {
    dados = { titulo: 'Caminho Livre', corpo: evento.data ? evento.data.text() : '' };
  }
  const titulo = dados.titulo || 'Caminho Livre';
  const url = dados.url || '/';

  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(titulo, {
        body: dados.corpo || '',
        icon: '/icone-192.png',
        badge: '/icone-192.png',
        tag: url,
        renotify: true,
        requireInteraction: false,
        data: { url },
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
        for (const janela of janelas) {
          janela.postMessage({ tipo: 'caminho-livre:push', ...dados, titulo, url });
        }
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || '/';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(url);
          return janela.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
