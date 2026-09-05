/**
 * Série d'opérations : une photo de page entière contient TOUTE la liste (a, b, c…).
 *
 * Pourquoi cette famille existe : l'app demandait auparavant à l'élève de reprendre la
 * photo en cadrant sur un seul exercice. Pour une page de six opérations, cela signifiait
 * six photos — et en attendant, le classifieur voyait dans les résidus d'OCR (« ween »,
 * « eens », les étiquettes « b) », « c) ») autant d'inconnues, et annonçait « Système de
 * 2 équations » sur une simple liste d'additions.
 *
 * Le moteur arithmétique sait déjà résoudre chaque ligne. Il suffit donc de découper la
 * liste et de l'appliquer à chaque calcul : la photo de la page entière devient la
 * manière NORMALE d'utiliser l'app, au lieu d'être son pire écran.
 *
 * Le résultat est rendu comme une Solution ordinaire (une étape par exercice), ce qui
 * évite de toucher à l'écran de résultat et à l'historique.
 */
import { resoutArithmetique, écritureScolaire } from "./arithmetique";
import { ErreurResolution, type Etape, type Solution } from "./types";

/**
 * Une ligne d'exercice : purement numérique (aucune lettre, ce qui écarte les consignes
 * et les équations à inconnue) et contenant au moins deux nombres.
 *
 * L'opération n'est PAS exigée ici, volontairement : une ligne mal lue par l'OCR doit
 * rester dans la liste, à sa place, plutôt que d'être supprimée. La supprimer décalait
 * toutes les étiquettes suivantes — l'élève lisait « b) » en face de ce que son cahier
 * numérote « c) ». Elle sera signalée « à vérifier » par resoutListe.
 */
function estCalcul(ligne: string): boolean {
  if (!/^[\d\s+\-*/().,]+$/.test(ligne)) return false;
  return (ligne.match(/\d+/g) ?? []).length >= 2;
}

/**
 * Extrait les calculs d'un texte multi-lignes. Les lignes de consigne
 * (« Effectuer les opérations suivantes ») sont ignorées : elles ne contiennent
 * pas de calcul. À utiliser sur du texte déjà passé par normaliseOCR, qui place
 * un exercice par ligne et a retiré étiquettes et blancs de réponse.
 */
export function découpeExercices(texte: string): string[] {
  return texte
    .split("\n")
    .map((l) => l.replace(/=\s*$/, "").trim())
    .filter((l) => l.length > 0 && estCalcul(l));
}

/** Étiquettes rendues à l'affichage, dans l'ordre de la page. */
const ÉTIQUETTES = "abcdefghijklmnopqrstuvwxyz";

export function resoutListe(énoncé: string): Solution {
  const calculs = découpeExercices(énoncé);
  if (calculs.length < 2)
    throw new ErreurResolution(
      "Cette photo ne contient qu'un seul calcul.",
      "Relance la résolution : un calcul unique est traité par le moteur des priorités.",
    );

  const étapes: Etape[] = [];
  const réponses: string[] = [];
  let résolus = 0;

  calculs.forEach((calcul, i) => {
    const étiquette = ÉTIQUETTES[i] ?? String(i + 1);
    const lisible = écritureScolaire(calcul);
    let sol: Solution | null = null;
    try {
      sol = resoutArithmetique(calcul);
    } catch {
      // Un calcul mal lu ne doit pas faire échouer toute la page : on le signale
      // à sa place et on rend quand même les autres réponses.
      sol = null;
    }

    if (!sol) {
      étapes.push({
        étape: i + 1,
        opération: `${étiquette}) ${lisible}`,
        explication: "Ce calcul n'a pas pu être lu correctement. Corrige-le dans le texte détecté, puis relance.",
        résultat_intermédiaire: "à vérifier",
      });
      réponses.push(`${étiquette}) ?`);
      return;
    }

    résolus++;
    // Le détail du calcul, dans l'ordre où il doit être mené. C'est la valeur
    // pédagogique : montrer POURQUOI on obtient ce résultat.
    const détail = sol.étapes.map((e) => e.opération).join("  puis  ");
    étapes.push({
      étape: i + 1,
      opération: `${étiquette}) ${lisible} = ${sol.réponse}`,
      explication: sol.étapes.length > 1 ? détail : "Un seul calcul à effectuer.",
      résultat_intermédiaire: sol.réponse,
    });
    réponses.push(`${étiquette}) ${sol.réponse}`);
  });

  if (résolus === 0)
    throw new ErreurResolution(
      "Aucun des calculs de cette photo n'a pu être résolu.",
      "Corrige le texte détecté au-dessus, puis relance.",
    );

  const avecPriorité = calculs.some((c) => /[*/]/.test(c) && /[+\-]/.test(c));

  return {
    type: "liste_exercices",
    énoncé: `${calculs.length} opérations à effectuer`,
    réponse: réponses.join("   ·   "),
    étapes,
    méthode: avecPriorité
      ? "Dans chaque calcul : × et ÷ avant + et −, puis de gauche à droite."
      : "Chaque calcul se mène de gauche à droite.",
  };
}
