/**
 * Système de 2 équations à 2 inconnues, résolu par déterminants (Cramer),
 * avec des explications rédigées comme une substitution scolaire.
 */
import { parse } from "mathjs";
import { Rat, R } from "./rational";
import { nettoieExpression, variables } from "./poly";
import { ErreurResolution, Etapes, type Solution } from "./types";

/** Extrait a, b, c de « a·x + b·y = c » (dans n'importe quel ordre). */
function coefficients(éq: string, x: string, y: string): { a: Rat; b: Rat; c: Rat } {
  const [g, d] = nettoieExpression(éq).split("=");
  if (d === undefined) throw new Error(`Équation sans signe = : ${éq}`);
  const lire = (src: string) => {
    let a = R(0);
    let b = R(0);
    let k = R(0);
    const visite = (n: any, signe: number, facteur: Rat) => {
      switch (n.type) {
        case "OperatorNode":
          if (n.fn === "add") {
            visite(n.args[0], signe, facteur);
            visite(n.args[1], signe, facteur);
            return;
          }
          if (n.fn === "subtract") {
            visite(n.args[0], signe, facteur);
            visite(n.args[1], -signe, facteur);
            return;
          }
          if (n.fn === "unaryMinus") {
            visite(n.args[0], -signe, facteur);
            return;
          }
          if (n.fn === "multiply" || n.fn === "divide") {
            const [g1, d1] = n.args;
            const constante = (m: any): Rat | null => {
              if (m.type === "ConstantNode") return R(Number(m.value));
              if (m.type === "OperatorNode" && m.fn === "unaryMinus") {
                const c = constante(m.args[0]);
                return c ? c.oppose() : null;
              }
              if (m.type === "OperatorNode" && m.fn === "divide") {
                const a1 = constante(m.args[0]);
                const b1 = constante(m.args[1]);
                return a1 && b1 ? a1.div(b1) : null;
              }
              return null;
            };
            const cg = constante(g1);
            const cd = constante(d1);
            if (cg && n.fn === "multiply") return visite(d1, signe, facteur.fois(cg));
            if (cd) return visite(g1, signe, n.fn === "multiply" ? facteur.fois(cd) : facteur.div(cd));
            throw new Error("Produit de deux inconnues : ce n'est pas un système linéaire");
          }
          throw new Error(`Opérateur non supporté dans un système : ${n.fn}`);
        case "ParenthesisNode":
          return visite(n.content, signe, facteur);
        case "ConstantNode":
          k = k.plus(facteur.fois(R(Number(n.value) * signe)));
          return;
        case "SymbolNode": {
          const contrib = facteur.fois(R(signe));
          if (n.name === x) a = a.plus(contrib);
          else if (n.name === y) b = b.plus(contrib);
          else throw new Error(`Inconnue inattendue : ${n.name}`);
          return;
        }
        default:
          throw new Error("Expression non linéaire");
      }
    };
    visite(parse(src), 1, R(1));
    return { a, b, k };
  };
  const G = lire(g);
  const D = lire(d);
  return { a: G.a.moins(D.a), b: G.b.moins(D.b), c: D.k.moins(G.k) };
}

/** Découpe un énoncé en 2 équations (retour à la ligne, « ; », « et », « , »). */
export function découpeSysteme(énoncé: string): string[] {
  return énoncé
    .split(/\n|;|\bet\b|,(?![0-9])/i)
    .map((s) => s.replace(/^[\s{(\[]*|[\s})\]]*$/g, "").trim())
    .filter((s) => s.includes("="));
}

export function resoutSysteme(énoncé: string): Solution {
  const éqs = découpeSysteme(énoncé);
  if (éqs.length < 2)
    throw new ErreurResolution(
      "Je n'ai trouvé qu'une seule équation.",
      "Écris les deux équations sur deux lignes séparées.",
    );
  const vs = [...new Set(éqs.flatMap((e) => variables(e)))].sort();
  if (vs.length !== 2)
    throw new ErreurResolution(
      `Ce système a ${vs.length} inconnue(s) : ${vs.join(", ") || "aucune"}.`,
      "MathScan V1 résout les systèmes à exactement 2 inconnues (souvent x et y).",
    );
  const [x, y] = vs;
  let E1, E2;
  try {
    E1 = coefficients(éqs[0], x, y);
    E2 = coefficients(éqs[1], x, y);
  } catch (e) {
    throw new ErreurResolution(`Lecture du système impossible : ${(e as Error).message}`);
  }

  const e = new Etapes();
  const ligne = (C: typeof E1) =>
    `${C.a.toString()}${x} + ${C.b.toString()}${y} = ${C.c.toString()}`;
  e.ajoute(
    "Mettre le système en forme",
    `On range chaque équation sous la forme a${x} + b${y} = c.`,
    `(1) ${ligne(E1)}\n(2) ${ligne(E2)}`,
  );

  const dét = E1.a.fois(E2.b).moins(E2.a.fois(E1.b));
  e.ajoute(
    "Calculer le déterminant",
    "Le déterminant a₁b₂ − a₂b₁ dit si le système a une solution unique.",
    `D = ${E1.a.toString()}×${E2.b.toString()} − ${E2.a.toString()}×${E1.b.toString()} = ${dét.toString()}`,
  );

  if (dét.estNul()) {
    const proportionnel = E1.a.fois(E2.c).egal(E2.a.fois(E1.c));
    e.ajoute(
      "Conclure",
      proportionnel
        ? "Le déterminant est nul et les deux équations sont proportionnelles : elles décrivent la même droite."
        : "Le déterminant est nul et les équations ne sont pas proportionnelles : les droites sont parallèles.",
      proportionnel ? "Une infinité de solutions" : "Aucune solution",
    );
    return {
      type: "systeme_2x2",
      énoncé,
      réponse: proportionnel ? "Une infinité de solutions" : "Aucune solution",
      étapes: e.tableau,
      méthode: "Méthode : déterminant nul ⇒ droites parallèles (0 solution) ou confondues (∞).",
    };
  }

  const vx = E1.c.fois(E2.b).moins(E2.c.fois(E1.b)).div(dét);
  const vy = E1.a.fois(E2.c).moins(E2.a.fois(E1.c)).div(dét);
  e.ajoute(
    `Calculer ${x}`,
    `On remplace la colonne de ${x} par les seconds membres, puis on divise par D.`,
    `${x} = (${E1.c.toString()}×${E2.b.toString()} − ${E2.c.toString()}×${E1.b.toString()}) / ${dét.toString()} = ${vx.toString()}`,
  );
  e.ajoute(
    `Calculer ${y}`,
    `Même principe pour ${y} : on peut aussi remplacer ${x} = ${vx.toString()} dans l'équation (1).`,
    `${y} = (${E1.a.toString()}×${E2.c.toString()} − ${E2.a.toString()}×${E1.c.toString()}) / ${dét.toString()} = ${vy.toString()}`,
  );
  const v1 = E1.a.fois(vx).plus(E1.b.fois(vy));
  const v2 = E2.a.fois(vx).plus(E2.b.fois(vy));
  e.ajoute(
    "Vérification",
    "On réinjecte le couple trouvé dans les deux équations de départ.",
    `(1) → ${v1.toString()} = ${E1.c.toString()} ✓\n(2) → ${v2.toString()} = ${E2.c.toString()} ✓`,
  );
  return {
    type: "systeme_2x2",
    énoncé,
    réponse: `${x} = ${vx.toString()} ; ${y} = ${vy.toString()}`,
    étapes: e.tableau,
    méthode:
      "Méthode : par substitution ou combinaison — ici par déterminants, ce qui revient au même résultat.",
  };
}

export { coefficients as coefficientsSysteme };
export type { Rat };
