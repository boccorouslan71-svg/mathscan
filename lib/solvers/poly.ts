/**
 * Extraction de polynômes depuis une expression, via l'arbre syntaxique de math.js.
 * math.js sert de parseur robuste ; l'algèbre est faite en rationnels exacts (Rat)
 * pour que les étapes affichées soient justes au centième près… ou plutôt : exactes.
 *
 * Supporté : + - * / (par une constante), parenthèses, puissances entières positives,
 * moins unaire, variable unique ou double (systèmes).
 */
import { parse, type MathNode } from "mathjs";
import { Rat, R } from "./rational";

/** Polynôme creux : clé = degré, valeur = coefficient rationnel. */
export type Poly = Map<number, Rat>;

export const polyVide = (): Poly => new Map();

export function polyAjoute(p: Poly, deg: number, coef: Rat): Poly {
  const actuel = p.get(deg) ?? R(0);
  const somme = actuel.plus(coef);
  if (somme.estNul()) p.delete(deg);
  else p.set(deg, somme);
  return p;
}

const polySomme = (a: Poly, b: Poly): Poly => {
  const r = new Map(a);
  b.forEach((c, d) => polyAjoute(r, d, c));
  return r;
};
const polyOppose = (a: Poly): Poly => {
  const r = polyVide();
  a.forEach((c, d) => r.set(d, c.oppose()));
  return r;
};
const polyProduit = (a: Poly, b: Poly): Poly => {
  const r = polyVide();
  a.forEach((ca, da) => b.forEach((cb, db) => polyAjoute(r, da + db, ca.fois(cb))));
  return r;
};

export const degre = (p: Poly): number => (p.size === 0 ? 0 : Math.max(...p.keys()));
export const coef = (p: Poly, d: number): Rat => p.get(d) ?? R(0);

/** Normalise les notations « scolaires » que math.js ne parse pas tel quel. */
export function nettoieExpression(src: string): string {
  let s = src
    .replace(/[×∗·]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[–—−]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁴/g, "^4")
    .replace(/√\s*\(?([0-9.]+)\)?/g, "sqrt($1)")
    .replace(/,(\d)/g, ".$1") // 3,5 -> 3.5 (virgule décimale française)
    .replace(/\s+/g, " ")
    .trim();
  // Multiplication implicite : 2x -> 2*x, 3(x+1) -> 3*(x+1), x(x+1) -> x*(x+1)
  s = s
    .replace(/(\d)\s*([a-zA-Z(])/g, "$1*$2")
    .replace(/([a-zA-Z0-9)])\s*\(/g, "$1*(")
    .replace(/\)\s*([a-zA-Z0-9(])/g, ")*$1")
    // sqrt*( recréé par la règle précédente -> on répare
    .replace(/\b(sqrt|abs|sin|cos|tan|log)\*\(/g, "$1(");
  return s;
}

/** Convertit un noeud math.js en polynôme d'une variable. Lève si non polynomial. */
export function versPoly(noeud: MathNode, variable: string): Poly {
  switch (noeud.type) {
    case "ConstantNode": {
      const v = Number((noeud as any).value);
      const p = polyVide();
      if (v !== 0) p.set(0, R(v));
      return p;
    }
    case "SymbolNode": {
      const nom = (noeud as any).name;
      if (nom !== variable) throw new Error(`Variable inattendue « ${nom} »`);
      return new Map([[1, R(1)]]);
    }
    case "ParenthesisNode":
      return versPoly((noeud as any).content, variable);
    case "OperatorNode": {
      const n = noeud as any;
      const args: MathNode[] = n.args;
      if (n.fn === "unaryMinus") return polyOppose(versPoly(args[0], variable));
      if (n.fn === "add") return polySomme(versPoly(args[0], variable), versPoly(args[1], variable));
      if (n.fn === "subtract")
        return polySomme(versPoly(args[0], variable), polyOppose(versPoly(args[1], variable)));
      if (n.fn === "multiply")
        return polyProduit(versPoly(args[0], variable), versPoly(args[1], variable));
      if (n.fn === "divide") {
        const num = versPoly(args[0], variable);
        const den = versPoly(args[1], variable);
        if (degre(den) > 0 || den.size === 0)
          throw new Error("Division par une expression contenant l'inconnue (hors V1)");
        const k = coef(den, 0);
        const r = polyVide();
        num.forEach((c, d) => r.set(d, c.div(k)));
        return r;
      }
      if (n.fn === "pow") {
        const base = versPoly(args[0], variable);
        const exp = versPoly(args[1], variable);
        if (degre(exp) > 0) throw new Error("Exposant contenant l'inconnue (hors V1)");
        const e = coef(exp, 0);
        if (!e.estEntier || e.valeur < 0) throw new Error("Exposant non entier positif (hors V1)");
        let r: Poly = new Map([[0, R(1)]]);
        for (let i = 0; i < e.valeur; i++) r = polyProduit(r, base);
        return r;
      }
      throw new Error(`Opérateur non supporté : ${n.fn}`);
    }
    default:
      throw new Error(`Expression non polynomiale (${noeud.type})`);
  }
}

/** Parse « membre_gauche = membre_droit » et renvoie le polynôme gauche - droit. */
export function equationVersPoly(texte: string, variable: string): { p: Poly; g: Poly; d: Poly } {
  const [gauche, droite] = nettoieExpression(texte).split("=");
  if (droite === undefined) throw new Error("Aucun signe = trouvé");
  const g = versPoly(parse(gauche), variable);
  const d = versPoly(parse(droite), variable);
  return { p: polySomme(g, polyOppose(d)), g, d };
}

/** Rend un polynôme lisible : « 2x^2 - 3x + 1 ». */
export function polyTexte(p: Poly, variable = "x"): string {
  const degres = [...p.keys()].sort((a, b) => b - a);
  if (degres.length === 0) return "0";
  return degres
    .map((d, i) => {
      const c = coef(p, d);
      const signe = c.valeur < 0 ? " - " : i === 0 ? "" : " + ";
      const abs = c.valeur < 0 ? c.oppose() : c;
      const coefTxt = abs.egal(1) && d > 0 ? "" : abs.toString();
      const varTxt = d === 0 ? "" : d === 1 ? variable : `${variable}^${d}`;
      return `${signe}${coefTxt}${varTxt}`;
    })
    .join("");
}

/** Détecte la ou les variables présentes dans une expression. */
export function variables(texte: string): string[] {
  const vus = new Set<string>();
  try {
    parse(nettoieExpression(texte.replace(/=/g, "-(") + (texte.includes("=") ? ")" : ""))).traverse(
      (n: any) => {
        if (n.type === "SymbolNode" && /^[a-zA-Z]$/.test(n.name)) vus.add(n.name);
      },
    );
  } catch {
    for (const m of texte.matchAll(/\b([a-zA-Z])\b/g)) vus.add(m[1]);
  }
  return [...vus];
}
