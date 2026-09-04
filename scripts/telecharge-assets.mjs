/**
 * Télécharge en local les binaires nécessaires au fonctionnement HORS-LIGNE :
 *   - worker + coeur WASM de Tesseract.js  -> public/tesseract/
 *   - modèles de langue français + anglais -> public/tesseract/lang/
 *
 * Exécuté automatiquement avant chaque build (script "prebuild" de package.json),
 * y compris sur Vercel. Les fichiers ne sont pas versionnés dans Git (voir .gitignore) :
 * ils sont reconstruits au build, ce qui garde le dépôt léger — important quand on
 * pousse depuis un téléphone.
 *
 * Sans ces fichiers locaux, Tesseract.js irait les chercher sur un CDN au premier
 * scan : l'app resterait fonctionnelle mais la promesse « zéro data ensuite » serait
 * plus fragile (le Service Worker ne contrôle pas un domaine tiers aussi bien).
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dossierT = join(racine, "public", "tesseract");
const dossierL = join(dossierT, "lang");

const version = JSON.parse(
  await readFile(join(racine, "package.json"), "utf8"),
).dependencies["tesseract.js"].replace(/[^0-9.]/g, "");

const FICHIERS = [
  // Worker et coeur WASM, épinglés sur la version installée
  { url: `https://unpkg.com/tesseract.js@${version}/dist/worker.min.js`, dest: join(dossierT, "worker.min.js") },
  { url: "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core.wasm.js", dest: join(dossierT, "tesseract-core.wasm.js") },
  { url: "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js", dest: join(dossierT, "tesseract-core-simd.wasm.js") },
  // Modèles de langue (format « fast », le meilleur compromis taille/précision sur mobile)
  { url: "https://tessdata.projectnaptha.com/4.0.0/fra.traineddata.gz", dest: join(dossierL, "fra.traineddata.gz") },
  { url: "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz", dest: join(dossierL, "eng.traineddata.gz") },
];

mkdirSync(dossierL, { recursive: true });

let téléchargés = 0;
let ignorés = 0;
const échecs = [];

for (const { url, dest } of FICHIERS) {
  if (existsSync(dest)) {
    ignorés++;
    continue;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await pipeline(r.body, createWriteStream(dest));
    téléchargés++;
    console.log(`✅ ${dest.replace(racine, ".")}`);
  } catch (e) {
    // On échoue bruyamment : un build « réussi » sans ces fichiers casserait l'offline
    échecs.push(`${url} → ${e.message}`);
    console.error(`❌ ${url} : ${e.message}`);
  }
}

console.log(`\nAssets OCR : ${téléchargés} téléchargé(s), ${ignorés} déjà présent(s).`);
if (échecs.length) {
  console.error(
    "\nCertains assets OCR manquent. Le build continue, mais Tesseract.js retombera sur le CDN\n" +
      "au premier scan (l'app reste utilisable). Relance `node scripts/telecharge-assets.mjs`\n" +
      "avec une connexion stable pour restaurer l'offline complet.",
  );
}
