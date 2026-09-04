/**
 * Adaptateur Needle 2 (Cactus Compute) — OPTIONNEL, désactivé par défaut.
 *
 * Pourquoi optionnel : Cactus publie Needle 2 avec une démo WebAssembly, mais il
 * n'existe pas (à ce jour) de SDK npm officiel « needle-web » supporté. Les builds
 * WASM navigateur disponibles sont communautaires. Faire dépendre la classification
 * — donc TOUT le parcours utilisateur — d'un binaire de 14 Mo non officiel, alors
 * que des règles déterministes classent mieux du texte OCR déjà structuré, serait
 * un risque produit inutile.
 *
 * Le classifieur par règles (./index.ts) est donc le chemin par défaut, et Needle
 * vient en RENFORT sur les énoncés en langage naturel (problèmes rédigés), une fois
 * un build validé posé dans /public/needle/.
 *
 * Activation :
 *   1. déposer le modèle + le glue JS dans public/needle/ (needle.js, needle.wasm, needle-2.bin)
 *   2. NEXT_PUBLIC_NEEDLE_ENABLED=1 dans les variables d'environnement Vercel
 * Le Service Worker met /needle/* en cache (CacheFirst) : offline après 1er chargement.
 */
import type { Classification } from "./index";
import type { TypeExercice } from "../solvers/types";

export const NEEDLE_ACTIF = process.env.NEXT_PUBLIC_NEEDLE_ENABLED === "1";

/** Schéma d'extraction demandé au modèle (Needle contraint sa sortie à ce JSON). */
export const SCHEMA_EXTRACTION = {
  type: "object",
  properties: {
    est_exercice_de_maths: { type: "boolean" },
    type_exercice: {
      type: "string",
      enum: [
        "equation_lineaire",
        "equation_quadratique",
        "systeme_2x2",
        "fraction",
        "pourcentage",
        "geometrie",
        "derivee",
        "conversion_unite",
        "inconnu",
      ],
    },
    énoncé_normalisé: { type: "string" },
    valeurs: { type: "array", items: { type: "number" } },
    unités: { type: "array", items: { type: "string" } },
  },
  required: ["est_exercice_de_maths", "type_exercice", "énoncé_normalisé"],
} as const;

type ModuleNeedle = {
  extract: (opts: { text: string; schema: unknown }) => Promise<{
    est_exercice_de_maths: boolean;
    type_exercice: TypeExercice;
    énoncé_normalisé: string;
  }>;
};

let instance: ModuleNeedle | null = null;
let chargement: Promise<ModuleNeedle | null> | null = null;

/** Charge le runtime WASM une seule fois (puis il vit en cache SW). */
async function charge(): Promise<ModuleNeedle | null> {
  if (!NEEDLE_ACTIF || typeof window === "undefined") return null;
  if (instance) return instance;
  if (!chargement)
    chargement = (async () => {
      try {
        // Import dynamique par URL calculée : le bundler ne tente pas de résoudre le
        // module au build (Needle est un asset optionnel déposé dans /public/needle).
        const url = `${location.origin}/needle/needle.js`;
        const mod = await import(/* webpackIgnore: true */ url);
        const runtime = await (mod as any).createNeedle({
          modelUrl: "/needle/needle-2.bin",
          wasmUrl: "/needle/needle.wasm",
        });
        instance = runtime as ModuleNeedle;
        return instance;
      } catch (e) {
        console.warn("[MathScan] Needle 2 indisponible, classification par règles utilisée.", e);
        return null;
      }
    })();
  return chargement;
}

/**
 * Renfort de classification. Renvoie null si Needle est absent/désactivé/en échec :
 * l'appelant garde alors la classification par règles. Jamais d'erreur remontée à
 * l'utilisateur pour un composant optionnel.
 */
export async function affine(
  texte: string,
  parRègles: Classification,
): Promise<Classification | null> {
  const n = await charge();
  if (!n) return null;
  try {
    const r = await n.extract({ text: texte, schema: SCHEMA_EXTRACTION });
    if (!r.est_exercice_de_maths)
      return {
        ...parRègles,
        type: "inconnu",
        confiance: 0,
        message:
          "Cette image ne semble pas contenir un exercice de maths. Reprends la photo en cadrant l'énoncé.",
      };
    if (r.type_exercice === "inconnu") return null;
    return {
      ...parRègles,
      type: r.type_exercice,
      confiance: Math.max(parRègles.confiance, 0.9),
      replis: [parRègles.type, ...parRègles.replis].filter((t) => t !== r.type_exercice),
      données: { ...parRègles.données, texte_normalisé: r.énoncé_normalisé || parRègles.données.texte_normalisé },
    };
  } catch (e) {
    console.warn("[MathScan] Extraction Needle échouée, on garde les règles.", e);
    return null;
  }
}
