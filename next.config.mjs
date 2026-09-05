import withPWAInit from "@ducanh2912/next-pwa";

/**
 * Configuration PWA — le Service Worker met en cache :
 *  - tous les assets Next.js (précache automatique du build)
 *  - le coeur WASM + le modèle de langue Tesseract.js (runtime caching, CacheFirst)
 *  - le binaire WASM optionnel de Needle 2
 *  - les pages visitées (StaleWhileRevalidate)
 * Après le premier chargement, l'app est intégralement utilisable hors-ligne.
 */
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  /*
   * INDISPENSABLE — sans cette option, le tableau `runtimeCaching` ci-dessous était
   * purement et simplement ignoré : le Service Worker déployé ne contenait que les
   * règles par défaut du plugin. Vérifié en production, où les caches présents
   * étaient « static-js-assets », « pages », « start-url »… et aucun
   * « mathscan-tesseract ». Conséquence : le modèle de langue (.gz) et le binaire
   * WASM n'étaient retenus par AUCUNE règle du Service Worker. Ils ne survivaient
   * que grâce au cache IndexedDB interne de Tesseract.js — un seul filet, alors que
   * tout l'argument du produit est « ça marche sans internet ».
   *
   * Contrôle de non-régression après build : `grep mathscan-tesseract public/sw.js`
   * doit trouver la règle. Si elle disparaît, l'app se remet à retélécharger.
   */
  extendDefaultRuntimeCaching: true,
  // Fallback hors-ligne : toute navigation non mise en cache retombe sur /offline
  fallbacks: { document: "/offline" },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    // Les modèles (langue Tesseract ~15 Mo, WASM) dépassent la limite par défaut (2 Mo)
    maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
    runtimeCaching: [
      {
        // Coeur WASM + worker Tesseract.js servis depuis /tesseract (local, versionné)
        urlPattern: /\/tesseract\/.*\.(?:js|wasm|gz|traineddata)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "mathscan-tesseract",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Modèle Needle 2 (optionnel, désactivé par défaut — voir lib/classify/needle.ts)
        urlPattern: /\/needle\/.*$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "mathscan-needle",
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "mathscan-fonts", expiration: { maxEntries: 20 } },
      },
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "mathscan-pages",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 60 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tesseract.js et les modules WASM ne doivent pas être bundlés côté serveur
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    if (!isServer) config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  headers: async () => [
    {
      // Requis pour les workers WASM multi-thread (Tesseract.js SIMD/threads)
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      ],
    },
  ],
};

export default withPWA(nextConfig);
