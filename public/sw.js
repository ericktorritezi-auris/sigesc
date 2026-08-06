// SIGESC — Service Worker (Sprint 1: viabiliza a instalação como PWA)
// Estratégia simples: cacheia a casca estática (shell) para abrir mais rápido
// e funcionar minimamente offline. Chamadas de API (/api/*) NUNCA são cacheadas —
// dados de pesquisa/respostas sempre precisam vir frescos do servidor.

const CACHE_NAME = 'sigesc-shell-v1';

const SHELL_ASSETS = [
  '/login.html',
  '/index.html',
  '/css/style.css',
  '/js/footer.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_NAME)
          .map((chave) => caches.delete(chave))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca intercepta chamadas de API — sempre direto na rede.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health')) {
    return;
  }

  // Shell estático: cache-first, com atualização em segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((resposta) => {
          if (resposta && resposta.status === 200) {
            const clone = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resposta;
        })
        .catch(() => cached); // offline: cai no cache se a rede falhar

      return cached || fetchPromise;
    })
  );
});
