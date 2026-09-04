# Assets OCR (générés au build)

Ce dossier reçoit, au moment du build, les fichiers nécessaires à l'OCR **hors-ligne** :

```
public/tesseract/worker.min.js
public/tesseract/tesseract-core.wasm.js
public/tesseract/tesseract-core-simd.wasm.js
public/tesseract/lang/fra.traineddata.gz
public/tesseract/lang/eng.traineddata.gz
```

Ils sont téléchargés par `scripts/telecharge-assets.mjs`, appelé automatiquement
via le script `prebuild` (donc aussi sur Vercel). Ils ne sont volontairement pas
versionnés dans Git pour garder le dépôt léger.

Pour les récupérer en local :

```bash
node scripts/telecharge-assets.mjs
```

Le Service Worker met ensuite `/tesseract/*` en cache (stratégie CacheFirst,
expiration 1 an) : après le premier scan, plus aucune requête réseau.
