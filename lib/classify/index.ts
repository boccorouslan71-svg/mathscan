/**
 * Classifieur d'exercices — déterministe, 0 Mo, instantané.
 *
 * Rôle (celui décrit dans le cahier des charges pour Needle) :
 *  1. dire si le texte scanné est bien un exercice de maths reconnu,
 *  2. le classer parmi les types couverts en V1,
 *  3. rendre un JSON propre transmis au moteur de résolution.
 *
 * Il travaille sur du texte déjà extrait par l'OCR : à ce stade, des règles
 * lexicales/symboliques sont plus fiables (et 14 Mo plus légères) qu'un modèle.
 * L'adaptateur Needle 2 (./needle.ts) peut prendre le relais sur les énoncés
 * rédigés en langage naturel — il est optionnel et désactivé par défaut.
 */
import type { TypeExercice } from "../solvers/types";
import { UNITES_CONNUES } from "../solvers/unites";

export interface Classification {
  type: TypeExercice;
  /** 0 → 1 : confiance de la règle qui a gagné. */
  confiance: number;
  /** Types à essayer ensuite si le moteur principal échoue. */
  replis: TypeExercice[];
  /** Données structurées extraites (JSON propre pour le moteur). */
  données: {
    texte_normalisé: string;
    équations: string[];
    nombres: number[];
    inconnues: string[];
    unités: string[];
    mots_clés: string[];
  };
  /** Message prêt à afficher si type = inconnu. */
  message?: string;
}

/** Nettoyage OCR : symboles mathématiques mal reconnus, espaces, confusions O/0. */
export function normaliseOCR(brut: string): string {
  let s = brut
    .replace(/\r/g, "")
    .replace(/[«»""]/g, '"')
    .replace(/[×✕✖]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[–—−‒]/g, "-")
    .replace(/[⁄∕]/g, "/")
    .replace(/\u00A0/g, " ")
    .replace(/[|]/g, "1")
    .replace(/(\d)\s*[oO]\s*(\d)/g, "$1 0 $2")
    .replace(/([0-9])[lI](?=[^a-zA-Z]|$)/g, "$11")
    .replace(/\bx\s*2\b/g, "x^2")
    .replace(/[ \t]{2,}/g, " ");
  // « x = ? » et parasites de fin
  s = s.replace(/[.·•]+\s*$/gm, "").trim();
  return s;
}

const MOTS: Record<string, TypeExercice> = {
  aire: "geometrie",
  surface: "geometrie",
  superficie: "geometrie",
  périmètre: "geometrie",
  perimetre: "geometrie",
  circonférence: "geometrie",
  rayon: "geometrie",
  diamètre: "geometrie",
  triangle: "geometrie",
  rectangle: "geometrie",
  carré: "geometrie",
  cercle: "geometrie",
  losange: "geometrie",
  dérivée: "derivee",
  derivee: "derivee",
  "f'": "derivee",
  dériver: "derivee",
  pourcentage: "pourcentage",
  remise: "pourcentage",
  réduction: "pourcentage",
  augmentation: "pourcentage",
  hausse: "pourcentage",
  solde: "pourcentage",
  tva: "pourcentage",
  simplifie: "fraction",
  simplifier: "fraction",
  irréductible: "fraction",
  fraction: "fraction",
  convertis: "conversion_unite",
  convertir: "conversion_unite",
  conversion: "conversion_unite",
};

export function classifie(brut: string): Classification {
  const texte = normaliseOCR(brut);
  const bas = texte.toLowerCase();
  const équations = texte
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter((l) => /=/.test(l) && /[a-zA-Z]/.test(l));
  const nombres = [...texte.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
  const inconnues = [...new Set([...texte.matchAll(/(?<![a-zA-Z])([a-zA-Z])(?![a-zA-Z])/g)].map((m) => m[1]))]
    .filter((v) => !"eE".includes(v) || /[a-df-zA-Z]/.test(v))
    .filter((v) => /[a-z]/.test(v));
  const unités = UNITES_CONNUES.filter((u) =>
    new RegExp(`\\b${u.replace("/", "\\/")}\\b`, "i").test(bas.replace(/²/g, "2").replace(/³/g, "3")),
  );
  const mots_clés = Object.keys(MOTS).filter((m) => bas.includes(m));
  const données = { texte_normalisé: texte, équations, nombres, inconnues, unités, mots_clés };

  const rendu = (type: TypeExercice, confiance: number, replis: TypeExercice[] = []): Classification => ({
    type,
    confiance,
    replis,
    données,
  });

  // Aucun chiffre ET aucune équation : ce n'est pas un exercice de maths exploitable
  if (nombres.length === 0 && équations.length === 0)
    return {
      ...rendu("inconnu", 0),
      message:
        "Je n'ai pas trouvé de calcul dans cette image. Reprends la photo en cadrant bien l'exercice, ou corrige le texte détecté.",
    };

  // 1. Système de 2 équations
  if (équations.length >= 2 && new Set(inconnues).size >= 2)
    return rendu("systeme_2x2", 0.95, ["equation_lineaire"]);

  // 2. Conversion d'unités (nécessite 2 unités de mesure ou un mot-clé explicite)
  if ((unités.length >= 2 && /\b(en|vers|->|→|=)\b/.test(bas)) || (mots_clés.some((m) => MOTS[m] === "conversion_unite") && unités.length >= 1))
    return rendu("conversion_unite", 0.9, ["geometrie"]);

  // 3. Dérivée
  if (/d[eé]riv|f\s*'\s*\(/i.test(bas)) return rendu("derivee", 0.92);

  // 4. Géométrie (mot de forme + mot de mesure)
  const motsGéo = mots_clés.filter((m) => MOTS[m] === "geometrie");
  if (motsGéo.length >= 1 && nombres.length >= 1)
    return rendu("geometrie", motsGéo.length >= 2 ? 0.93 : 0.75, ["conversion_unite"]);

  // 5. Pourcentage — y compris la variation « le prix passe de A à B » (sans signe %)
  if (/(?:passe|passer|revient|augmente|baisse|diminue)\s*(?:de\s*)?\d+[^0-9]{1,12}(?:à|a|au)\s*\d+/i.test(bas))
    return rendu("pourcentage", 0.85, ["fraction"]);
  if (/%/.test(texte) || mots_clés.some((m) => MOTS[m] === "pourcentage"))
    return rendu("pourcentage", /%/.test(texte) ? 0.9 : 0.7, ["fraction"]);

  // 6. Équation (une seule inconnue)
  if (équations.length === 1) {
    const quad = /\^\s*2|²/.test(équations[0]);
    return rendu(quad ? "equation_quadratique" : "equation_lineaire", 0.88, [
      quad ? "equation_lineaire" : "equation_quadratique",
      "systeme_2x2",
    ]);
  }

  // 7. Fractions / calcul numérique pur
  if (/\d\s*\/\s*\d/.test(texte) || /[+\-*]/.test(texte))
    return rendu("fraction", /\d\s*\/\s*\d/.test(texte) ? 0.85 : 0.6, ["pourcentage"]);

  return {
    ...rendu("inconnu", 0),
    message:
      "Cet exercice n'est pas encore couvert par MathScan. La V1 gère : équations, systèmes 2×2, fractions, pourcentages, aires/périmètres, dérivées et conversions d'unités.",
  };
}
