/**
 * Dérivées de polynômes : règle de la puissance, terme par terme.
 * (Trigonométrie et produits/quotients : prévus en V2.)
 */
import { R } from "./rational";
import { coef, degre, nettoieExpression, polyTexte, versPoly, variables, type Poly } from "./poly";
import { parse } from "mathjs";
import { ErreurResolution, Etapes, type Solution } from "./types";

export function resoutDerivee(énoncé: string): Solution {
  // On isole l'expression : « Calculer la dérivée de f(x) = 3x^2 + 2x - 5 » -> « 3x^2 + 2x - 5 »
  // Attention : \w ne couvre pas les lettres accentuées en JS, d'où [^\s] pour « Dérivée ».
  let expr = énoncé
    .replace(/d[eé]riv[^\s]*/gi, " ")
    .replace(/f\s*'\s*\(\s*[a-z]\s*\)\s*=?/gi, " ")
    .replace(/[a-z]\s*\(\s*[a-z]\s*\)\s*=/gi, " ") // f(x) = , g(t) = …
    .replace(
      /\b(calcul\w*|d[eé]termin\w*|trouv\w*|donn\w*|fonction|suivante?|ci-dessous|premi[eè]re|la|le|les|des|du|de|d'|et|pour|puis)\b/gi,
      " ",
    )
    .replace(/[?:;]/g, " ")
    .replace(/^\s*[a-z]\s*=/i, " ") // y = …
    .replace(/\s+/g, " ")
    .trim();
  expr = nettoieExpression(expr);
  const v = variables(expr).includes("x") ? "x" : (variables(expr)[0] ?? "x");

  let p: Poly;
  try {
    p = versPoly(parse(expr), v);
  } catch (e) {
    throw new ErreurResolution(
      `Je ne sais pas dériver cette expression : ${(e as Error).message}`,
      "MathScan V1 dérive les polynômes (ex : 3x^3 − 5x + 2). Trigonométrie et quotients arrivent en V2.",
    );
  }

  const e = new Etapes();
  e.ajoute(
    "Écrire la fonction",
    "On identifie chaque terme du polynôme, du degré le plus haut au plus bas.",
    `f(${v}) = ${polyTexte(p, v)}`,
  );
  e.ajoute(
    "Rappeler la règle",
    "Pour chaque terme a·xⁿ, la dérivée est n·a·xⁿ⁻¹. La dérivée d'une constante est 0.",
    "(a·xⁿ)' = n·a·xⁿ⁻¹",
  );

  const dérivée: Poly = new Map();
  const détails: string[] = [];
  [...p.keys()]
    .sort((a, b) => b - a)
    .forEach((d) => {
      const c = coef(p, d);
      if (d === 0) {
        détails.push(`(${c.toString()})' = 0`);
        return;
      }
      const nc = c.fois(R(d));
      dérivée.set(d - 1, nc);
      const terme = d === 1 ? `${c.toString()}${v}` : `${c.toString()}${v}^${d}`;
      const res = d - 1 === 0 ? nc.toString() : d - 1 === 1 ? `${nc.toString()}${v}` : `${nc.toString()}${v}^${d - 1}`;
      détails.push(`(${terme})' = ${d} × ${c.toString()}${v}^${d - 1} = ${res}`);
    });

  e.ajoute("Dériver terme par terme", "On applique la règle à chaque terme séparément.", détails.join("\n"));
  const txt = dérivée.size === 0 ? "0" : polyTexte(dérivée, v);
  e.ajoute("Rassembler", "On additionne les dérivées de tous les termes.", `f'(${v}) = ${txt}`);
  if (degre(p) >= 2)
    e.ajoute(
      "Contrôle rapide",
      "Le degré de la dérivée doit valoir le degré de départ moins 1.",
      `degré ${degre(p)} → degré ${Math.max(0, degre(p) - 1)} ✓`,
    );

  return {
    type: "derivee",
    énoncé,
    réponse: `f'(${v}) = ${txt}`,
    étapes: e.tableau,
    méthode: "Méthode : (a·xⁿ)' = n·a·xⁿ⁻¹, la dérivée d'une constante est nulle.",
  };
}
