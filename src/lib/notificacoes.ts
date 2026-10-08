export type EstadoPermissao = NotificationPermission | 'indisponivel';

export function estadoPermissao(): EstadoPermissao {
  return typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission;
}

export async function pedirPermissao(): Promise<EstadoPermissao> {
  if (typeof Notification === 'undefined') return 'indisponivel';
  return Notification.requestPermission();
}

/**
 * Mostra uma notificação do sistema se a permissão foi dada. Com o backend
 * real, quem chama showNotification é o service worker ao receber o push
 * (public/sw-push.js); aqui o mock dispara pela página, com o app aberto.
 */
export async function notificarSistema(titulo: string, corpo: string, url: string): Promise<void> {
  if (estadoPermissao() !== 'granted') return;
  const opcoes: NotificationOptions = {
    body: corpo,
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    tag: url,
    data: { url },
  };
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) {
      await registro.showNotification(titulo, opcoes);
      return;
    }
    // Sem service worker (npm run dev): notificação direta, só no desktop.
    new Notification(titulo, opcoes);
  } catch {
    // Notificação é um reforço; o aviso dentro do app já foi mostrado.
  }
}
