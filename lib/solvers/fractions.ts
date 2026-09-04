/**
 * Fractions : simplification et opérations (+ − × ÷), en rationnels exacts.
 * Les étapes montrent le dénominateur commun, ce qui est LE point bloquant au collège.
 */
import { parse } from "mathjs";
import { Rat, R } from "./rational";
import { nettoieExpression } from "./poly";
import { ErreurResolution, Etapes, type Solution } from "./types";

const ppcm = (a: number, b: number): number => {
  const pgcd = (x: number, y: number): number => (y ? pgcd(y, x % y) : Math.abs(x) || 1);
  return Math.abs(a * b) / pgcd(a, b);
};

/** Évalue une expression arithmétique en rationnels exacts (sans passer par les flottants). */
function evalue(n: any): Rat {
  switch (n.type) {
    case "ConstantNode":
      return R(Number(n.value));
    case "ParenthesisNode":
      return evalue(n.content);
    case "OperatorNode": {
      const [a, b] = n.args;
      switch (n.fn) {
        case "unaryMinus":
          return evalue(a).oppose();
        case "add":
          return evalue(a).plus(evalue(b));
        case "subtract":
          return evalue(a).moins(evalue(b));
        case "multiply":
          return evalue(a).fois(evalue(b));
        case "divide":
          return evalue(a).div(evalue(b));
        case "pow": {
          const e = evalue(b);
          if (!e.estEntier) throw new Error("Exposant non entier");
          return evalue(a).puiss(e.valeur);
        }
      }
      throw new Error(`Opérateur non supporté : ${n.fn}`);
    }
    default:
      throw new Error("L'expression contient une lettre : ce n'est pas un calcul de fractions");
  }
}

/** Récupère les fractions littérales du texte, pour expliquer le dénominateur commun. */
function fractionsDuTexte(src: string): Rat[] {
  return [...src.matchAll(/(-?\d+)\s*\/\s*(\d+)/g)].map((m) => R(Number(m[1]), Number(m[2])));
}

export function resoutFraction(énoncé: string): Solution {
  const expr = nettoieExpression(énoncé.replace(/[=?]+\s*$/g, "").replace(/^.*?:/s, ""));
  let val: Rat;
  try {
    val = evalue(parse(expr));
  } catch (e) {
    throw new ErreurResolution(
      `Calcul impossible : ${(e as Error).message}`,
      "Corrige le texte reconnu (ex : « 3/4 + 5/6 »).",
    );
  }
  const e = new Etapes();
  e.ajoute(
    "Lire le calcul",
    "On repère les fractions et l'opération demandée.",
    expr.replace(/\*/g, " × ").replace(/\//g, "/"),
  );

  const fr = fractionsDuTexte(expr);
  const additive = /[+\-]/.test(expr.replace(/^-/, ""));
  if (fr.length >= 2 && additive) {
    const dénoms = fr.map((f) => f.d);
    const commun = dénoms.reduce(ppcm, 1);
    e.ajoute(
      "Chercher le dénominateur commun",
      `On ne peut additionner ou soustraire que des fractions de même dénominateur. Le plus petit commun multiple de ${dénoms.join(", ")} est ${commun}.`,
      `dénominateur commun = ${commun}`,
    );
    e.ajoute(
      "Mettre au même dénominateur",
      "On multiplie haut et bas de chaque fraction par le facteur qui manque : la valeur ne change pas.",
      fr.map((f) => `${f.toString()} = ${(f.n * (commun / f.d))}/${commun}`).join("\n"),
    );
  }
  if (fr.length >= 2 && /\*/.test(expr)) {
    e.ajoute(
      "Multiplier les fractions",
      "Pour un produit, on multiplie les numérateurs entre eux et les dénominateurs entre eux.",
      `${fr.map((f) => f.toString()).join(" × ")}`,
    );
  }
  if (/\/\s*\(?\s*-?\d+\s*\/\s*\d+/.test(expr)) {
    e.ajoute(
      "Diviser = multiplier par l'inverse",
      "Diviser par une fraction revient à multiplier par cette fraction retournée.",
      "a/b ÷ c/d = a/b × d/c",
    );
  }
  e.ajoute(
    "Simplifier le résultat",
    "On divise numérateur et dénominateur par leur PGCD pour obtenir la fraction irréductible.",
    val.toString(),
  );
  const mixte = val.mixte();
  if (mixte)
    e.ajoute(
      "Forme mixte (facultatif)",
      "La fraction est supérieure à 1 : on peut l'écrire en partie entière + reste.",
      `${val.toString()} = ${mixte}`,
    );

  return {
    type: "fraction",
    énoncé,
    réponse: `${val.toString()}${val.estEntier ? "" : ` ≈ ${val.déc(3)}`}`,
    étapes: e.tableau,
    méthode:
      "Méthode : même dénominateur pour + et −, produit direct pour ×, multiplication par l'inverse pour ÷, puis simplification.",
  };
}
