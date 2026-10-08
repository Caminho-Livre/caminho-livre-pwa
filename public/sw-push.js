/* Carregado pelo service worker gerado (workbox importScripts).
   Hoje só trata o clique na notificação. O evento "push" já está aqui para
   quando o backend real enviar Web Push (VAPID): o payload esperado é
   { "titulo": "...", "corpo": "...", "url": "/alerta/<id>" }. */

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (_) {
    dados = { titulo: 'Caminho Livre', corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Caminho Livre', {
      body: dados.corpo || '',
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      tag: dados.url || 'caminho-livre',
      data: { url: dados.url || '/' },
    }),
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
