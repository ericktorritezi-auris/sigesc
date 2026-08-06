// SIGESC — Instalação como app (PWA)
// Android/Chrome: usa o prompt nativo do navegador (beforeinstallprompt).
// iPhone/Safari: a Apple não permite prompt automático — mostramos instrução manual.

(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SIGESC][PWA] Falha ao registrar service worker:', err);
    });
  }

  let deferredPrompt = null;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS

  if (isStandalone) return; // já está instalado, não mostra nada

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  function criarBotaoInstalarAndroid() {
    const btn = document.createElement('button');
    btn.textContent = '📲 Instalar app';
    btn.className = 'pwa-install-btn';
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[SIGESC][PWA] Resultado da instalação:', outcome);
      deferredPrompt = null;
      btn.remove();
    });
    document.body.appendChild(btn);
  }

  function criarAvisoIOS() {
    const aviso = document.createElement('div');
    aviso.className = 'pwa-ios-hint';
    aviso.innerHTML =
      'Instale o SIGESC no seu iPhone: toque em <strong>Compartilhar</strong> ' +
      '⬆️ e depois em <strong>“Adicionar à Tela de Início”</strong>.' +
      '<button aria-label="Fechar">✕</button>';
    aviso.querySelector('button').addEventListener('click', () => aviso.remove());
    document.body.appendChild(aviso);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    criarBotaoInstalarAndroid();
  });

  if (isIOS) {
    // Pequeno atraso para não competir com o carregamento inicial da página.
    setTimeout(criarAvisoIOS, 1500);
  }
})();
