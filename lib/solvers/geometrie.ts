/**
 * Aires et périmètres des formes de base : carré, rectangle, triangle, cercle.
 * On extrait les mesures ET leur unité, puis on rend le résultat dans la bonne unité (u², u).
 */
import { Rat, R } from "./rational";
import { ErreurResolution, Etapes, type Solution } from "./types";

const N = "([0-9]+(?:[.,][0-9]+)?)";
const U = "\\s*(km|hm|dam|m|dm|cm|mm)?";
const nb = (s: string) => Number(s.replace(",", "."));

type Forme = "carre" | "rectangle" | "triangle" | "cercle";

function mesure(t: string, ...noms: string[]): { v: Rat; u: string } | null {
  for (const nom of noms) {
    const m =
      t.match(new RegExp(`${nom}\\s*(?:=|de|:|vaut|mesure)?\\s*${N}${U}`, "i")) ||
      t.match(new RegExp(`${N}${U}\\s*(?:de\\s*)?${nom}`, "i"));
    if (m) {
      const [a, b, c] = [m[1], m[2], m[3]];
      // Selon l'ordre du motif, le nombre est en 1 et l'unité en 2
      const val = /^[0-9]/.test(a) ? a : b;
      const uni = /^[0-9]/.test(a) ? b : c;
      return { v: R(nb(val)), u: uni ?? "" };
    }
  }
  return null;
}

export function resoutGeometrie(énoncé: string): Solution {
  const t = énoncé.toLowerCase().replace(/\s+/g, " ");
  const veutAire = /aire|surface|superficie/.test(t);
  const veutPérim = /p[eé]rim[eè]tre|contour|circonf[eé]rence|clotur|clôtur/.test(t);
  const forme: Forme | null = /cercle|disque|rond|rayon|diam[eè]tre/.test(t)
    ? "cercle"
    : /triangle/.test(t)
      ? "triangle"
      : /rectangle|longueur|largeur/.test(t)
        ? "rectangle"
        : /carr[eé]/.test(t)
          ? "carre"
          : null;
  if (!forme)
    throw new ErreurResolution(
      "Je n'ai pas identifié la figure géométrique.",
      "Précise la forme : carré, rectangle, triangle ou cercle.",
    );

  const e = new Etapes();
  let réponse = "";
  const unité = (u: string, carré = false) => (u ? ` ${u}${carré ? "²" : ""}` : "");

  if (forme === "carre") {
    const c = mesure(t, "c[oô]t[eé]", "arête") ?? mesure(t, "carr[eé]");
    if (!c) throw manque("la longueur du côté");
    e.ajoute("Identifier la figure et sa mesure", "Un carré a 4 côtés égaux : une seule mesure suffit.", `côté c = ${c.v.déc()}${unité(c.u)}`);
    if (veutAire || !veutPérim) {
      const a = c.v.puiss(2);
      e.ajoute("Calculer l'aire", "Aire du carré = côté × côté.", `${c.v.déc()} × ${c.v.déc()} = ${a.déc(2)}${unité(c.u, true)}`);
      réponse += `Aire = ${a.déc(2)}${unité(c.u, true)}`;
    }
    if (veutPérim || !veutAire) {
      const p = c.v.fois(R(4));
      e.ajoute("Calculer le périmètre", "Périmètre du carré = 4 × côté.", `4 × ${c.v.déc()} = ${p.déc(2)}${unité(c.u)}`);
      réponse += `${réponse ? " ; " : ""}Périmètre = ${p.déc(2)}${unité(c.u)}`;
    }
  }

  if (forme === "rectangle") {
    const L = mesure(t, "longueur", "long");
    const l = mesure(t, "largeur", "large");
    if (!L || !l) throw manque("la longueur et la largeur");
    e.ajoute("Identifier les deux dimensions", "Un rectangle est défini par sa longueur et sa largeur.", `L = ${L.v.déc()}${unité(L.u)} ; l = ${l.v.déc()}${unité(l.u)}`);
    if (L.u && l.u && L.u !== l.u)
      throw new ErreurResolution(
        `Les deux mesures ne sont pas dans la même unité (${L.u} et ${l.u}).`,
        "Convertis d'abord les deux longueurs dans la même unité.",
      );
    if (veutAire || !veutPérim) {
      const a = L.v.fois(l.v);
      e.ajoute("Calculer l'aire", "Aire du rectangle = Longueur × largeur.", `${L.v.déc()} × ${l.v.déc()} = ${a.déc(2)}${unité(L.u, true)}`);
      réponse += `Aire = ${a.déc(2)}${unité(L.u, true)}`;
    }
    if (veutPérim || !veutAire) {
      const p = L.v.plus(l.v).fois(R(2));
      e.ajoute("Calculer le périmètre", "Périmètre = 2 × (Longueur + largeur), car il y a deux fois chaque côté.", `2 × (${L.v.déc()} + ${l.v.déc()}) = ${p.déc(2)}${unité(L.u)}`);
      réponse += `${réponse ? " ; " : ""}Périmètre = ${p.déc(2)}${unité(L.u)}`;
    }
  }

  if (forme === "triangle") {
    const b = mesure(t, "base", "c[oô]t[eé]");
    const h = mesure(t, "hauteur", "haut");
    if (!b || !h)
      throw manque("la base et la hauteur (le périmètre d'un triangle demande ses 3 côtés)");
    e.ajoute("Identifier base et hauteur", "L'aire d'un triangle utilise une base et la hauteur qui lui correspond.", `base = ${b.v.déc()}${unité(b.u)} ; hauteur = ${h.v.déc()}${unité(h.u)}`);
    const a = b.v.fois(h.v).div(R(2));
    e.ajoute("Appliquer la formule", "Aire = (base × hauteur) / 2 — c'est la moitié d'un rectangle de mêmes dimensions.", `(${b.v.déc()} × ${h.v.déc()}) / 2 = ${a.déc(2)}${unité(b.u, true)}`);
    réponse = `Aire = ${a.déc(2)}${unité(b.u, true)}`;
  }

  if (forme === "cercle") {
    const r = mesure(t, "rayon");
    const d = mesure(t, "diam[eè]tre");
    if (!r && !d) throw manque("le rayon ou le diamètre");
    const rayon = r ?? { v: d!.v.div(R(2)), u: d!.u };
    if (!r && d)
      e.ajoute("Passer du diamètre au rayon", "Le rayon est la moitié du diamètre.", `r = ${d.v.déc()} / 2 = ${rayon.v.déc()}${unité(d.u)}`);
    e.ajoute("Identifier le rayon", "Toutes les formules du cercle partent du rayon.", `r = ${rayon.v.déc()}${unité(rayon.u)}`);
    const PI = Math.PI;
    if (veutAire || !veutPérim) {
      const a = rayon.v.puiss(2).valeur * PI;
      e.ajoute("Calculer l'aire", "Aire du disque = π × r².", `π × ${rayon.v.déc()}² ≈ ${a.toFixed(2)}${unité(rayon.u, true)}`);
      réponse += `Aire ≈ ${a.toFixed(2)}${unité(rayon.u, true)}`;
    }
    if (veutPérim || !veutAire) {
      const p = 2 * PI * rayon.v.valeur;
      e.ajoute("Calculer la circonférence", "Périmètre du cercle = 2 × π × r.", `2 × π × ${rayon.v.déc()} ≈ ${p.toFixed(2)}${unité(rayon.u)}`);
      réponse += `${réponse ? " ; " : ""}Périmètre ≈ ${p.toFixed(2)}${unité(rayon.u)}`;
    }
  }

  return {
    type: "geometrie",
    énoncé,
    réponse,
    étapes: e.tableau,
    méthode:
      "Rappel : carré A = c², P = 4c · rectangle A = L×l, P = 2(L+l) · triangle A = b×h/2 · cercle A = πr², P = 2πr.",
  };
}

const manque = (quoi: string) =>
  new ErreurResolution(
    `Il me manque ${quoi}.`,
    "Ajoute la mesure manquante dans le texte reconnu, puis relance la résolution.",
  );

export type { Rat };
