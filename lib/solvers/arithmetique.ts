/**
 * Arithmétique avec priorités des opérations et parenthèses.
 *
 * Pourquoi cette famille existe : « Calculer en respectant les priorités des
 * opérations » est le cœur du programme visé (6e/5e), et c'était précisément
 * l'exercice photographié par l'utilisateur. Faute de famille dédiée, le classifieur
 * repliait ces énoncés sur « Fractions », qui expliquait le PGCD et les dénominateurs
 * — hors sujet, même quand le résultat tombait juste.
 *
 * La résolution est volontairement pas-à-pas plutôt qu'un simple eval() : la valeur
 * pédagogique est de MONTRER l'ordre d'évaluation, qui est exactement ce que
 * l'exercice demande d'apprendre.
 */
import { ErreurResolution, Etapes, type Solution } from "./types";

type Elem = number | string;

/** Affichage francophone : « × », « ÷ », virgule décimale. */
function formate(n: number): string {
  if (!Number.isFinite(n)) throw new ErreurResolution("Le calcul ne donne pas un nombre fini.");
  const arrondi = Math.round(n * 10000) / 10000;
  return Number.isInteger(arrondi) ? String(arrondi) : String(arrondi).replace(".", ",");
}

const SIGNE: Record<string, string> = { "*": "×", "/": "÷", "+": "+", "-": "−" };

function affiche(elems: Elem[]): string {
  return elems
    .map((e) => (typeof e === "number" ? formate(e) : (SIGNE[e] ?? e)))
    .join(" ")
    .replace(/\(\s/g, "(")
    .replace(/\s\)/g, ")");
}

/** Découpe l'expression en nombres, opérateurs et parenthèses. */
function découpe(expr: string): Elem[] {
  const elems: Elem[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(expr[i + 1] ?? ""))) {
      let j = i;
      while (j < expr.length && /[0-9.,]/.test(expr[j])) j++;
      const brut = expr.slice(i, j).replace(",", ".");
      const v = Number(brut);
      if (!Number.isFinite(v)) throw new ErreurResolution(`Nombre illisible : « ${brut} »`);
      elems.push(v);
      i = j;
      continue;
    }
    if ("+-*/()".includes(c)) {
      // Signe négatif : en début d'expression, après une parenthèse ouvrante
      // ou après un opérateur, le « - » appartient au nombre.
      const précédent = elems[elems.length - 1];
      const estUnaire =
        c === "-" && (elems.length === 0 || précédent === "(" || (typeof précédent === "string" && "+-*/".includes(précédent)));
      if (estUnaire && /[0-9.]/.test(expr[i + 1] ?? "")) {
        let j = i + 1;
        while (j < expr.length && /[0-9.,]/.test(expr[j])) j++;
        elems.push(-Number(expr.slice(i + 1, j).replace(",", ".")));
        i = j;
        continue;
      }
      elems.push(c);
      i++;
      continue;
    }
    throw new ErreurResolution(
      `Symbole inattendu dans le calcul : « ${c} »`,
      "Corrige le texte détecté au-dessus, puis relance.",
    );
  }
  return elems;
}

function applique(a: number, op: string, b: number): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") {
    if (b === 0) throw new ErreurResolution("Division par zéro : ce calcul n'a pas de résultat.");
    return a / b;
  }
  throw new ErreurResolution(`Opérateur non géré : « ${op} »`);
}

/** Indice du premier opérateur à traiter dans une suite sans parenthèses. */
function prochainOperateur(elems: Elem[]): number {
  for (let i = 0; i < elems.length; i++)
    if (elems[i] === "*" || elems[i] === "/") return i;
  for (let i = 0; i < elems.length; i++)
    if (elems[i] === "+" || elems[i] === "-") return i;
  return -1;
}

const MAX_ETAPES = 40;

export function resoutArithmetique(énoncé: string): Solution {
  // « A = 7 × (3 + 5) » : on retient le nom pour l'afficher dans la réponse.
  const nommé = /^\s*([A-Za-z])\s*=\s*(.+)$/.exec(énoncé.replace(/=\s*$/, "").trim());
  const nom = nommé ? nommé[1] : null;
  const expr = (nommé ? nommé[2] : énoncé).replace(/=\s*$/, "").trim();

  let elems = découpe(expr);
  if (!elems.some((e) => typeof e === "string" && "+-*/".includes(e)))
    throw new ErreurResolution(
      "Aucune opération à effectuer dans ce calcul.",
      "Vérifie le texte détecté : il faut au moins une opération (+, −, ×, ÷).",
    );

  const étapes = new Etapes();
  const avaitParenthèses = elems.includes("(");
  const avaitPrioritaire = elems.some((e) => e === "*" || e === "/");
  const avaitAdditif = elems.some((e) => e === "+" || e === "-");
  let garde = 0;

  const réduisGroupe = (début: number, fin: number, dansParenthèses: boolean) => {
    // début/fin délimitent une suite sans parenthèses (indices inclusifs).
    while (true) {
      if (++garde > MAX_ETAPES)
        throw new ErreurResolution(
          "Ce calcul est trop long pour être détaillé pas à pas.",
          "Découpe-le en plusieurs scans.",
        );
      const tranche = elems.slice(début, fin + 1);
      const rel = prochainOperateur(tranche);
      if (rel === -1) break;
      const i = début + rel;
      const a = elems[i - 1];
      const b = elems[i + 1];
      const op = elems[i] as string;
      if (typeof a !== "number" || typeof b !== "number")
        throw new ErreurResolution(
          "Ce calcul est incomplet.",
          "Il manque un nombre autour d'une opération : corrige le texte détecté.",
        );
      const v = applique(a, op, b);
      const opérationLue = `${formate(a)} ${SIGNE[op]} ${formate(b)} = ${formate(v)}`;
      let explication: string;
      if (dansParenthèses)
        explication = "Les parenthèses passent avant tout le reste : on calcule leur contenu d'abord.";
      else if ((op === "*" || op === "/") && avaitAdditif)
        explication =
          op === "*"
            ? "La multiplication est prioritaire sur l'addition et la soustraction : on la fait avant."
            : "La division est prioritaire sur l'addition et la soustraction : on la fait avant.";
      else if (op === "*" || op === "/")
        explication = "× et ÷ ont la même priorité : on avance de gauche à droite.";
      else
        explication = avaitPrioritaire
          ? "Il ne reste que des additions et soustractions : on les fait de gauche à droite."
          : "Additions et soustractions se font de gauche à droite.";

      elems.splice(i - 1, 3, v);
      fin -= 2;
      étapes.ajoute(opérationLue, explication, affiche(elems));
    }
    return fin;
  };

  // 1. Les parenthèses, de la plus intérieure vers l'extérieure.
  while (elems.includes("(")) {
    let ouvre = -1;
    for (let i = 0; i < elems.length; i++) if (elems[i] === "(") ouvre = i;
    const ferme = elems.indexOf(")", ouvre);
    if (ferme === -1)
      throw new ErreurResolution(
        "Une parenthèse n'est pas fermée.",
        "Corrige le texte détecté : il manque une parenthèse fermante.",
      );
    réduisGroupe(ouvre + 1, ferme - 1, true);
    // L'indice de la parenthèse fermante a bougé : chaque réduction a retiré deux
    // éléments du tableau. Le relire est indispensable — s'y fier tel quel faisait
    // échouer tous les calculs parenthésés.
    const fermeAprès = elems.indexOf(")", ouvre);
    if (fermeAprès === -1)
      throw new ErreurResolution(
        "Une parenthèse n'est pas fermée.",
        "Corrige le texte détecté : il manque une parenthèse fermante.",
      );
    const dedans = elems.slice(ouvre + 1, fermeAprès);
    if (dedans.length !== 1 || typeof dedans[0] !== "number")
      throw new ErreurResolution(
        "Le contenu d'une parenthèse n'a pas pu être calculé.",
        "Corrige le texte détecté au-dessus.",
      );
    elems.splice(ouvre, fermeAprès - ouvre + 1, dedans[0] as number);
    // Multiplication implicite : « 3(4 + 2) » ou « (1 + 2)(3 + 4) » s'écrivent sans
    // signe dans les énoncés. Sans ce rétablissement, deux nombres se retrouvent
    // côte à côte et la résolution s'arrête.
    // La valeur du groupe est à l'indice `ouvre` : on traite d'abord ce qui suit,
    // car insérer avant décalerait tout le reste.
    if (typeof elems[ouvre + 1] === "number") elems.splice(ouvre + 1, 0, "*");
    if (ouvre > 0 && typeof elems[ouvre - 1] === "number") elems.splice(ouvre, 0, "*");
  }

  // 2. Le reste, par ordre de priorité.
  réduisGroupe(0, elems.length - 1, false);

  if (elems.length !== 1 || typeof elems[0] !== "number")
    throw new ErreurResolution(
      "Ce calcul n'a pas pu être mené jusqu'au bout.",
      "Corrige le texte détecté au-dessus, puis relance.",
    );

  const valeur = elems[0] as number;
  const réponse = nom ? `${nom} = ${formate(valeur)}` : formate(valeur);

  return {
    type: "arithmetique",
    énoncé,
    réponse,
    étapes: étapes.tableau,
    méthode: avaitParenthèses
      ? "Ordre de priorité : parenthèses d'abord, puis × et ÷, puis + et − de gauche à droite."
      : "Ordre de priorité : × et ÷ avant + et −, puis de gauche à droite.",
  };
}
