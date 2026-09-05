/**
 * OCR offline avec Tesseract.js.
 * Les binaires (worker, coeur WASM) et le modèle de langue sont servis depuis /public
 * — donc mis en cache par le Service Worker et disponibles hors-ligne dès le 2e lancement.
 * Voir public/tesseract/README.md pour la récupération des fichiers au build.
 */
import { createWorker, type Worker } from "tesseract.js";

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
}

/** Lance la reconnaissance sur une image (dataURL, Blob, canvas…). */
export async function lisImage(
  source: string | Blob | HTMLCanvasElement,
  onAvancement?: Avancement,
): Promise<ResultatOCR> {
  const w = await démarre(onAvancement);
  const { data } = await w.recognize(source as any);
  const texte = (data.text ?? "").trim();
  return { texte, confiance: data.confidence ?? 0, douteux: (data.confidence ?? 0) < 60 || texte.length < 3 };
}

/** Libère le worker (appelé quand on quitte le parcours de scan). */
export async function arrête(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    init = null;
  }
}
