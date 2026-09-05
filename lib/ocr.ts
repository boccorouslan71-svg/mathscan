/**
 * OCR offline avec Tesseract.js.
 * Les binaires (worker, coeur WASM) et le modèle de langue sont servis depuis /public
 * — donc mis en cache par le Service Worker et disponibles hors-ligne dès le 2e lancement.
 * Voir public/tesseract/README.md pour la récupération des fichiers au build.
 */
import { createWorker, type Worker } from "tesseract.js";
import { CANDIDATS_DIVISION, estDivision, grisDepuisCanvas, type Boite } from "./glyphes";

export type Avancement = (étape: string, ratio: number) => void;

let worker: Worker | null = null;
let init: Promise<Worker> | null = null;

const CHEMINS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/",
  langPath: "/tesseract/lang",
};

/**
 * PAS de tessedit_char_whitelist ici, volontairement.
 * Le moteur LSTM de Tesseract 4/5 reconnaît le texte par ligne entière, pas
 * caractère par caractère : une liste blanche le contraint mal et dégrade la
 * lecture. Surtout, toute liste écrite à la main finit par oublier un symbole —
 * « × » et « ÷ » manquaient, donc les multiplications et divisions des énoncés
 * étaient effacées avant même d'être interprétées. La normalisation des symboles
 * se fait après coup dans lib/classify (normaliseOCR), où elle est testable.
 */
async function démarre(onAvancement?: Avancement): Promise<Worker> {
  if (worker) return worker;
  if (!init)
    init = (async () => {
      try {
        const w = await createWorker(["fra", "eng"], 1, {
          ...CHEMINS,
          logger: (m) => {
            if (onAvancement && m.status)
              onAvancement(traduitStatut(m.status), typeof m.progress === "number" ? m.progress : 0);
          },
          // cacheMethod par défaut = IndexedDB : le modèle n'est téléchargé qu'une fois
        });
        await w.setParameters({ preserve_interword_spaces: "1" });
        worker = w;
        return w;
      } catch (e) {
        // Un échec ici = moteur ou modèle inaccessible. On le dit clairement :
        // le message remonte tel quel à l'écran de traitement.
        init = null;
        throw new Error(
          "Le moteur de lecture n'a pas pu démarrer. Vérifie ta connexion pour le premier scan, puis réessaie.",
          { cause: e },
        );
      }
    })();
  return init;
}

const traduitStatut = (s: string): string =>
  ({
    "loading tesseract core": "Chargement du moteur",
    "initializing tesseract": "Initialisation",
    "loading language traineddata": "Chargement du français",
    "initializing api": "Préparation",
    "recognizing text": "Lecture du texte",
  })[s] ?? s;

export interface ResultatOCR {
  texte: string;
  confiance: number;
  /** true si la confiance est trop basse pour être exploitée sans relecture. */
  douteux: boolean;
  /** Nombre de « ÷ » rétablis par géométrie, que le modèle avait lus « + ». */
  divisionsRétablies?: number;
}

/** Canvas aux dimensions natives de la source, pour lire les pixels des symboles. */
async function canvasDeSource(source: string | Blob | HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  try {
    // Un canvas est déjà exploitable tel quel. On le reconnaît en excluant les deux
    // autres formes : tester `instanceof HTMLCanvasElement` derrière un garde `typeof`
    // empêche le compilateur de restreindre le type, et référence une globale du
    // navigateur au moment du rendu serveur.
    if (typeof source !== "string" && !(source instanceof Blob)) return source;
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    try {
      const img = await new Promise<HTMLImageElement>((ok, ko) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => ko(new Error("image illisible"));
        i.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c;
    } finally {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    }
  } catch {
    // Pas de pixels accessibles : on garde le texte brut de l'OCR.
    return null;
  }
}

/**
 * Réécrit le texte en corrigeant les symboles de division que le modèle ne sait pas
 * lire (voir lib/glyphes.ts : « ÷ » est absent du modèle fra/eng et sort en « + »).
 * On ne touche qu'aux symboles candidats, et seulement si la géométrie du glyphe
 * confirme un « ÷ » — sinon on laisse ce que l'OCR a lu.
 */
function texteCorrigé(
  data: any,
  pixels: { gris: Uint8ClampedArray; largeur: number; hauteur: number } | null,
): { texte: string; corrections: number } {
  const blocs = data?.blocks;
  if (!pixels || !Array.isArray(blocs) || blocs.length === 0)
    return { texte: (data?.text ?? "").trim(), corrections: 0 };

  let corrections = 0;
  const lignesRendues: string[] = [];
  for (const b of blocs)
    for (const p of b?.paragraphs ?? [])
      for (const l of p?.lines ?? []) {
        const mots: string[] = [];
        for (const mot of l?.words ?? []) {
          const symboles = mot?.symbols ?? [];
          if (symboles.length === 0) {
            if (mot?.text) mots.push(mot.text);
            continue;
          }
          let rendu = "";
          for (const s of symboles) {
            const lu: string = s?.text ?? "";
            const boite: Boite | undefined = s?.bbox;
            if (
              boite &&
              CANDIDATS_DIVISION.has(lu) &&
              estDivision(pixels.gris, pixels.largeur, pixels.hauteur, boite)
            ) {
              rendu += "÷";
              if (lu !== "÷") corrections++;
            } else rendu += lu;
          }
          mots.push(rendu);
        }
        const ligne = mots.join(" ").trim();
        if (ligne) lignesRendues.push(ligne);
      }

  const texte = lignesRendues.join("\n").trim();
  // Filet de sécurité : si la reconstruction perd le contenu, on garde le texte brut.
  if (texte.length < Math.floor(((data?.text ?? "").trim().length || 0) * 0.5))
    return { texte: (data?.text ?? "").trim(), corrections: 0 };
  return { texte, corrections };
}

/** Lance la reconnaissance sur une image (dataURL, Blob, canvas…). */
export async function lisImage(
  source: string | Blob | HTMLCanvasElement,
  onAvancement?: Avancement,
): Promise<ResultatOCR> {
  const w = await démarre(onAvancement);
  // blocks: true expose la boîte de chaque symbole, indispensable pour trancher « ÷ ».
  const { data } = await w.recognize(source as any, {}, { blocks: true, text: true });
  const canvas = await canvasDeSource(source);
  const pixels = canvas ? grisDepuisCanvas(canvas) : null;
  const { texte, corrections } = texteCorrigé(data, pixels);
  return {
    texte,
    confiance: data.confidence ?? 0,
    douteux: (data.confidence ?? 0) < 60 || texte.length < 3,
    divisionsRétablies: corrections,
  };
}

/** Libère le worker (appelé quand on quitte le parcours de scan). */
export async function arrête(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    init = null;
  }
}
