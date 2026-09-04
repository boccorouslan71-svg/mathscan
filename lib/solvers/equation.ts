/**
 * Équations du 1er et 2nd degré, résolues en rationnels exacts.
 * Les explications sont rédigées en français simple, niveau collège/lycée.
 */
import { Rat, R, racine } from "./rational";
import { coef, degre, equationVersPoly, polyTexte, variables } from "./poly";
import { ErreurResolution, Etapes, type Solution } from "./types";

/** Choisit l'inconnue : x par défaut, sinon la première lettre trouvée. */
export function choisitInconnue(texte: string): string {
  const vs = variables(texte);
  if (vs.includes("x")) return "x";
  return vs[0] ?? "x";
}

export function resoutEquation(énoncé: string): Solution {
  const v = choisitInconnue(énoncé);
  let p;
  try {
    p = equationVersPoly(énoncé, v).p;
  } catch (e) {
    throw new ErreurResolution(
      `Je n'arrive pas à lire cette équation : ${(e as Error).message}`,
      "Vérifie le texte reconnu et corrige-le à la main (ex : « 2x + 3 = 7 »).",
    );
  }
  const d = degre(p);
  if (d === 0) {
    const nul = p.size === 0;
    return {
      type: "equation_lineaire",
      énoncé,
      réponse: nul ? "Tout nombre est solution" : "Aucune solution",
      étapes: new Etapes()
        .ajoute(
          "Tout ramener d'un seul côté",
          "On met tous les termes à gauche du signe égal.",
          `${polyTexte(p, v)} = 0`,
        )
        .ajoute(
          nul ? "Égalité toujours vraie" : "Égalité impossible",
          nul
            ? "L'inconnue a disparu et l'égalité est vraie : n'importe quelle valeur convient."
            : "L'inconnue a disparu et l'égalité est fausse : aucune valeur ne convient.",
          nul ? "0 = 0" : `${polyTexte(p, v)} = 0 est faux`,
        ).tableau,
      méthode: "Quand l'inconnue disparaît, on conclut sur la véracité de l'égalité restante.",
    };
  }
  if (d === 1) return resoutLineaire(énoncé, v, coef(p, 1), coef(p, 0));
  if (d === 2) return resoutQuadratique(énoncé, v, coef(p, 2), coef(p, 1), coef(p, 0));
  throw new ErreurResolution(
    `Cette équation est de degré ${d}.`,
    "MathScan V1 résout les degrés 1 et 2. Le degré 3 arrive dans une prochaine version.",
  );
}

/** a·x + b = 0 */
function resoutLineaire(énoncé: string, v: string, a: Rat, b: Rat): Solution {
  const e = new Etapes();
  e.ajoute(
    "Ramener tous les termes à gauche",
    `On déplace tout du même côté du signe égal pour obtenir la forme a${v} + b = 0.`,
    `${polyTexte(new Map([[1, a], [0, b]]), v)} = 0`,
  );
  e.ajoute(
    `Isoler ${v}`,
    `On enlève ${b.toString()} des deux côtés : ce qui est ajouté d'un côté doit être enlevé des deux.`,
    `${a.egal(1) ? "" : a.toString()}${v} = ${b.oppose().toString()}`,
  );
  const sol = b.oppose().div(a);
  if (!a.egal(1)) {
    e.ajoute(
      `Diviser par ${a.toString()}`,
      `Pour finir d'isoler ${v}, on divise les deux membres par le coefficient ${a.toString()}.`,
      `${v} = ${b.oppose().toString()} / ${a.toString()} = ${sol.toString()}`,
    );
  }
  e.ajoute(
    "Vérification",
    `On remplace ${v} par ${sol.toString()} dans l'équation de départ : l'égalité doit être vraie.`,
    `${v} = ${sol.toString()}${sol.estEntier ? "" : ` ≈ ${sol.déc(3)}`}`,
  );
  return {
    type: "equation_lineaire",
    énoncé,
    réponse: `${v} = ${sol.toString()}${sol.estEntier ? "" : ` ≈ ${sol.déc(3)}`}`,
    étapes: e.tableau,
    méthode:
      "Méthode : regrouper les termes en x d'un côté, les nombres de l'autre, puis diviser par le coefficient de x.",
  };
}

/** a·x² + b·x + c = 0 */
function resoutQuadratique(énoncé: string, v: string, a: Rat, b: Rat, c: Rat): Solution {
  const e = new Etapes();
  e.ajoute(
    "Mettre sous forme canonique",
    `On ramène l'équation à la forme a${v}² + b${v} + c = 0.`,
    `${polyTexte(new Map([[2, a], [1, b], [0, c]]), v)} = 0`,
  );
  e.ajoute(
    "Identifier a, b et c",
    "Ce sont les trois coefficients dont on a besoin pour le discriminant.",
    `a = ${a.toString()}, b = ${b.toString()}, c = ${c.toString()}`,
  );
  const delta = b.puiss(2).moins(R(4).fois(a).fois(c));
  e.ajoute(
    "Calculer le discriminant Δ = b² − 4ac",
    "Le discriminant indique le nombre de solutions : positif = 2, nul = 1, négatif = 0.",
    `Δ = (${b.toString()})² − 4 × ${a.toString()} × ${c.toString()} = ${delta.toString()}`,
  );

  if (delta.valeur < 0) {
    e.ajoute(
      "Conclure",
      "Δ est négatif : aucun nombre réel ne peut être solution (une racine carrée de nombre négatif n'existe pas dans ℝ).",
      "Aucune solution réelle",
    );
    return {
      type: "equation_quadratique",
      énoncé,
      réponse: "Aucune solution réelle (Δ < 0)",
      étapes: e.tableau,
      méthode: "Méthode : Δ = b² − 4ac, puis x = (−b ± √Δ) / 2a.",
    };
  }

  if (delta.estNul()) {
    const x0 = b.oppose().div(R(2).fois(a));
    e.ajoute(
      "Calculer la racine double",
      "Δ = 0 : il y a une seule solution, x = −b / 2a.",
      `${v} = −(${b.toString()}) / (2 × ${a.toString()}) = ${x0.toString()}`,
    );
    return {
      type: "equation_quadratique",
      énoncé,
      réponse: `${v} = ${x0.toString()} (racine double)`,
      étapes: e.tableau,
      méthode: "Méthode : Δ = b² − 4ac, puis x = (−b ± √Δ) / 2a.",
    };
  }

  const rac = racine(delta);
  e.ajoute(
    "Calculer √Δ",
    rac.exact
      ? "Le discriminant est un carré parfait : la racine est exacte."
      : "Le discriminant n'est pas un carré parfait : on garde une valeur approchée.",
    `√Δ = ${rac.texte}`,
  );
  const deuxA = R(2).fois(a);
  const num1 = b.oppose().plus(new Rat(rac.valeur));
  const num2 = b.oppose().moins(new Rat(rac.valeur));
  const x1 = num1.div(deuxA);
  const x2 = num2.div(deuxA);
  const fmt = (x: Rat) => (rac.exact ? x.toString() : x.déc(3));
  e.ajoute(
    "Appliquer la formule des racines",
    `On calcule les deux solutions avec ${v} = (−b ± √Δ) / 2a.`,
    `${v}₁ = (${b.oppose().toString()} + ${rac.texte}) / ${deuxA.toString()} = ${fmt(x1)}\n${v}₂ = (${b
      .oppose()
      .toString()} − ${rac.texte}) / ${deuxA.toString()} = ${fmt(x2)}`,
  );
  e.ajoute(
    "Vérification",
    `Somme des racines = −b/a = ${b.oppose().div(a).toString()}, produit = c/a = ${c.div(a).toString()} : cohérent.`,
    `${v}₁ = ${fmt(x1)} ; ${v}₂ = ${fmt(x2)}`,
  );
  return {
    type: "equation_quadratique",
    énoncé,
    réponse: `${v}₁ = ${fmt(x1)} ; ${v}₂ = ${fmt(x2)}`,
    étapes: e.tableau,
    méthode:
      "Méthode : identifier a, b, c → Δ = b² − 4ac → si Δ ≥ 0, x = (−b ± √Δ) / 2a.",
  };
}
