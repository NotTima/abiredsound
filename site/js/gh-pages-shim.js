// GitHub Pages & static hosting compatibility shim
// Loaded before module scripts so relative paths and offline API stubs work on any subpath.
(function () {
  const isStaticHost =
    location.hostname.endsWith('github.io') ||
    location.protocol === 'file:' ||
    location.search.includes('static=1');

  window.__RS_STATIC_HOST = isStaticHost;

  const origFetch = window.fetch.bind(window);
  const jsonOk = (obj) =>
    Promise.resolve(
      new Response(JSON.stringify(obj), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      })
    );

  window.fetch = function (input, init) {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    let pathname = rawUrl;
    try {
      pathname = new URL(rawUrl, location.href).pathname;
    } catch {}

    // Always resolve /api/catalog relative to <base> / current directory (works on github.io/<repo>/)
    if (pathname === '/api/catalog' || pathname.endsWith('/api/catalog')) {
      const relUrl = new URL('api/catalog', document.baseURI).href;
      return origFetch(relUrl, init);
    }

    // Stub backend-only endpoints when running on static hosting (GitHub Pages)
    if (isStaticHost && pathname.startsWith('/api/')) {
      if (pathname === '/api/auth/status') {
        return jsonOk({ authenticated: false, staticMode: true });
      }
      if (
        pathname.startsWith('/api/finds') ||
        pathname.startsWith('/api/report') ||
        pathname.startsWith('/api/sync') ||
        pathname === '/api/device' ||
        pathname === '/api/pin'
      ) {
        return jsonOk({ ok: true, staticMode: true });
      }
    }

    return origFetch(input, init);
  };

  // Prevent EventSource('/api/finds/stream') from spamming 404 reconnects on GitHub Pages
  if (isStaticHost && typeof window.EventSource === 'function') {
    const OrigES = window.EventSource;
    window.EventSource = function (url, cfg) {
      if (String(url).includes('/api/finds')) {
        return {
          readyState: 2,
          close() {},
          addEventListener() {},
          removeEventListener() {}
        };
      }
      return new OrigES(url, cfg);
    };
  }

  // Global fallback for any broken item icon <img>
  const FALLBACK_SVG =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="10" fill="#140c0f" stroke="#ef3b3b" stroke-opacity="0.45" stroke-width="2"/><path d="M22 26l10-6 10 6v12l-10 6-10-6z" fill="none" stroke="#ef3b3b" stroke-width="2" stroke-linejoin="round"/></svg>'
    );

  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && !img.dataset.rsFallback) {
        img.dataset.rsFallback = '1';
        img.src = FALLBACK_SVG;
      }
    },
    true
  );
})();
