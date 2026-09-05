/**
 * Types partagés du moteur de résolution.
 * Le moteur est 100% symbolique et déterministe : aucune IA générative n'intervient
 * dans le calcul, donc aucun risque d'hallucination sur un résultat.
 */

/** Une étape de résolution, telle que consommée par l'écran de résultat. */
export interface Etape {
  étape: number;
  opération: string;
  explication: string;
  résultat_intermédiaire: string;
}

/** Types d'exercices couverts en V1. */
export type TypeExercice =
  | "arithmetique"
  | "equation_lineaire"
  | "equation_quadratique"
  | "systeme_2x2"
  | "fraction"
  | "pourcentage"
  | "geometrie"
  | "derivee"
  | "conversion_unite"
  | "inconnu";

export const LIBELLES: Record<TypeExercice, { fr: string; en: string }> = {
  arithmetique: { fr: "Priorités des opérations", en: "Order of operations" },
  equation_lineaire: { fr: "Équation du 1er degré", en: "Linear equation" },
  equation_quadratique: { fr: "Équation du 2nd degré", en: "Quadratic equation" },
  systeme_2x2: { fr: "Système de 2 équations", en: "System of 2 equations" },
  fraction: { fr: "Fractions", en: "Fractions" },
  pourcentage: { fr: "Pourcentages", en: "Percentages" },
  geometrie: { fr: "Aire et périmètre", en: "Area and perimeter" },
  derivee: { fr: "Dérivée", en: "Derivative" },
  conversion_unite: { fr: "Conversion d'unités", en: "Unit conversion" },
  inconnu: { fr: "Non reconnu", en: "Not recognized" },
};

/** Résultat complet d'une résolution. */
export interface Solution {
  type: TypeExercice;
  énoncé: string;
  /** Réponse courte, pour le mode « Réponse rapide ». */
  réponse: string;
  /** Étapes détaillées, pour le mode « Explique-moi ». */
  étapes: Etape[];
  /** Rappel de méthode affiché en bas du résultat (pédagogie). */
  méthode?: string;
}

/** Erreur métier : l'énoncé est reconnu mais non résoluble en V1. */
export class ErreurResolution extends Error {
  constructor(
    message: string,
    readonly conseil?: string,
  ) {
    super(message);
    this.name = "ErreurResolution";
  }
}

/** Petit utilitaire de construction d'étapes (numérotation automatique). */
export class Etapes {
  private liste: Etape[] = [];
  ajoute(opération: string, explication: string, résultat_intermédiaire: string): this {
    this.liste.push({
      étape: this.liste.length + 1,
      opération,
      explication,
      résultat_intermédiaire,
    });
    return this;
  }
  get tableau(): Etape[] {
    return this.liste;
  }
}
