/**
 * Prépare les assets nécessaires au fonctionnement HORS-LIGNE de l'OCR :
 *   - worker + TOUTES les variantes du coeur WASM -> public/tesseract/
 *   - modèles de langue                          -> public/tesseract/lang/
 *
 * Exécuté avant chaque build (script "prebuild"), y compris sur Vercel.
 *
 * POURQUOI on copie depuis node_modules et non depuis un CDN :
 * Tesseract.js choisit AU RUNTIME la variante du coeur selon le navigateur
 * (SIMD disponible ou non, moteur LSTM ou non) — il peut donc réclamer
 * « tesseract-core-simd-lstm.wasm.js » là où un autre navigateur demande
 * « tesseract-core.wasm.js ». Lister les URLs à la main revenait à parier sur
 * ces noms : une variante oubliée = échec total du scan sur les navigateurs
 * concernés (bug constaté en production). On copie donc l'INTÉGRALITÉ du
 * paquet tesseract.js-core déjà installé et verrouillé par le lockfile :
 * aucun nom à devineer, aucune dérive de version possible.
 */
import { createWriteStream, mkdirSync, readdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dossierT = join(racine, "public", "tesseract");
const dossierL = join(dossierT, "lang");
const modules = join(racine, "node_modules");

mkdirSync(dossierL, { recursive: true });

const échecs = [];
let copiés = 0;

/* ---------- 1. Coeur WASM : toutes les variantes, depuis le paquet installé ---------- */
const src = join(modules, "tesseract.js-core");
if (!existsSync(src)) {
  échecs.push("paquet tesseract.js-core introuvable dans node_modules");
} else {
  // .wasm.js = glue chargée par importScripts ; .wasm = binaire que cette glue va chercher.
  const utiles = readdirSync(src).filter((f) => f.endsWith(".wasm.js") || f.endsWith(".wasm"));
  const variantes = utiles.filter((f) => f.endsWith(".wasm.js"));
  if (variantes.length < 4) {
    échecs.push(`seulement ${variantes.length} variante(s) de coeur trouvée(s), 4 attendues`);
  }
  for (const f of utiles) {
    copyFileSync(join(src, f), join(dossierT, f));
    copiés++;
  }
  console.log(`✅ coeur OCR : ${variantes.length} variantes + binaires (${utiles.length} fichiers)`);
}

/* ---------- 2. Worker, depuis le paquet installé (versions toujours alignées) ---------- */
const worker = join(modules, "tesseract.js", "dist", "worker.min.js");
if (existsSync(worker)) {
  copyFileSync(worker, join(dossierT, "worker.min.js"));
  copiés++;
  console.log("✅ worker.min.js");
} else {
  échecs.push("tesseract.js/dist/worker.min.js introuvable");
}

/* ---------- 3. Modèles de langue (absents du paquet npm -> téléchargement) ---------- */
const LANGUES = [
  { url: "https://tessdata.projectnaptha.com/4.0.0/fra.traineddata.gz", dest: join(dossierL, "fra.traineddata.gz") },
  { url: "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz", dest: join(dossierL, "eng.traineddata.gz") },
];

for (const { url, dest } of LANGUES) {
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`↩︎ déjà présent : ${dest.replace(racine, ".")}`);
    continue;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await pipeline(r.body, createWriteStream(dest));
    copiés++;
    console.log(`✅ ${dest.replace(racine, ".")}`);
  } catch (e) {
    échecs.push(`${url} → ${e.message}`);
  }
}

/* ---------- 4. Vérification finale : on échoue BRUYAMMENT ---------- */
const attendus = [
  "worker.min.js",
  "tesseract-core.wasm.js",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "lang/fra.traineddata.gz",
];
const manquants = attendus.filter((f) => {
  const p = join(dossierT, f);
  return !existsSync(p) || statSync(p).size === 0;
});

console.log(`\nAssets OCR : ${copiés} fichier(s) préparé(s).`);

if (manquants.length || échecs.length) {
  if (manquants.length) console.error("Fichiers manquants ou vides :\n  - " + manquants.join("\n  - "));
  if (échecs.length) console.error("Erreurs :\n  - " + échecs.join("\n  - "));
  console.error("\nSans ces fichiers l'OCR échoue au premier scan. Build interrompu.");
  process.exit(1);
}
console.log("Tous les assets OCR requis sont présents.");
