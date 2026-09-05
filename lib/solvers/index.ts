/**
 * Point d'entrée du moteur : reçoit un type d'exercice (donné par le classifieur)
 * et l'énoncé nettoyé, renvoie une Solution. Aucune dépendance au DOM :
 * ce module est testable en Node/Bun et réutilisable tel quel côté worker.
 */
import { resoutArithmetique } from "./arithmetique";
import { resoutListe } from "./liste";
import { resoutEquation } from "./equation";
import { resoutSysteme } from "./systeme";
import { resoutFraction } from "./fractions";
import { resoutPourcentage } from "./pourcentage";
import { resoutGeometrie } from "./geometrie";
import { resoutDerivee } from "./derivee";
import { resoutConversion } from "./unites";
import { ErreurResolution, type Solution, type TypeExercice } from "./types";

export * from "./types";

const MOTEURS: Record<Exclude<TypeExercice, "inconnu">, (é: string) => Solution> = {
  arithmetique: resoutArithmetique,
  liste_exercices: resoutListe,
  equation_lineaire: resoutEquation,
  equation_quadratique: resoutEquation,
  systeme_2x2: resoutSysteme,
  fraction: resoutFraction,
  pourcentage: resoutPourcentage,
  geometrie: resoutGeometrie,
  derivee: resoutDerivee,
  conversion_unite: resoutConversion,
};

export function resout(type: TypeExercice, énoncé: string): Solution {
  if (type === "inconnu")
    throw new ErreurResolution(
      "Type d'exercice non reconnu.",
      "Corrige le texte détecté ou reprends la photo en cadrant sur un seul exercice.",
    );
  const moteur = MOTEURS[type];
  return moteur(énoncé);
}

/**
 * Tente plusieurs types par ordre de plausibilité (utilisé quand le classifieur
 * hésite) : le premier moteur qui rend une solution gagne.
 */
export function resoutAvecReplis(types: TypeExercice[], énoncé: string): Solution {
  const erreurs: string[] = [];
  for (const t of types) {
    try {
      return resout(t, énoncé);
    } catch (e) {
      erreurs.push(`${t} : ${(e as Error).message}`);
    }
  }
  throw new ErreurResolution(
    "Aucun moteur n'a pu résoudre cet énoncé.",
    erreurs[0]?.split(" : ").slice(1).join(" : ") ||
      "Vérifie le texte reconnu, puis relance la résolution.",
  );
}
