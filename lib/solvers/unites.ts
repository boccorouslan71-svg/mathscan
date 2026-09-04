/**
 * Conversions d'unités courantes : longueur, masse, volume/capacité, aire, temps, vitesse.
 * Le facteur est toujours explicité (× ou ÷ par une puissance de 10) — c'est ça qu'on apprend.
 */
import { R } from "./rational";
import { ErreurResolution, Etapes, type Solution } from "./types";

type Famille = "longueur" | "masse" | "capacite" | "aire" | "volume" | "temps" | "vitesse";

/** Valeur de chaque unité exprimée dans l'unité de base de sa famille. */
const TABLE: Record<Famille, { base: string; unités: Record<string, number> }> = {
  longueur: {
    base: "m",
    unités: { km: 1000, hm: 100, dam: 10, m: 1, dm: 0.1, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254 },
  },
  masse: {
    base: "g",
    unités: { t: 1e6, q: 1e5, kg: 1000, hg: 100, dag: 10, g: 1, dg: 0.1, cg: 0.01, mg: 0.001, lb: 453.592 },
  },
  capacite: { base: "l", unités: { hl: 100, dal: 10, l: 1, dl: 0.1, cl: 0.01, ml: 0.001 } },
  aire: { base: "m2", unités: { km2: 1e6, ha: 1e4, a: 100, m2: 1, dm2: 0.01, cm2: 1e-4, mm2: 1e-6 } },
  volume: { base: "m3", unités: { km3: 1e9, m3: 1, dm3: 1e-3, cm3: 1e-6, mm3: 1e-9 } },
  temps: { base: "s", unités: { j: 86400, h: 3600, min: 60, s: 1, ms: 0.001 } },
  vitesse: { base: "m/s", unités: { "km/h": 1 / 3.6, "m/s": 1, "km/s": 1000, "m/min": 1 / 60 } },
};

/** Normalise l'écriture d'une unité (m², cm3, KM/H…). */
function normalise(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/\s/g, "")
    .replace(/litres?/, "l")
    .replace(/m[eè]tres?/, "m")
    .replace(/grammes?/, "g")
    .replace(/secondes?/, "s")
    .replace(/minutes?/, "min")
    .replace(/heures?/, "h")
    .replace(/jours?/, "j");
}

function famille(u: string): Famille | null {
  for (const [f, def] of Object.entries(TABLE))
    if (u in def.unités) return f as Famille;
  return null;
}

const UNITES = Object.values(TABLE).flatMap((d) => Object.keys(d.unités));
const MOTIF_U = UNITES.map((u) => u.replace("/", "\\/")).sort((a, b) => b.length - a.length).join("|");

export function resoutConversion(énoncé: string): Solution {
  const t = énoncé
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/\s+/g, " ");
  const m = t.match(
    new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*(${MOTIF_U})\\b[^0-9]*?(?:en|vers|=|->|→|convert\\w*\\s+en)\\s*(${MOTIF_U})\\b`, "i"),
  );
  if (!m)
    throw new ErreurResolution(
      "Je n'ai pas identifié les deux unités de la conversion.",
      "Écris par exemple « 2,5 km en m » ou « 750 ml en l ».",
    );

  const valeur = R(Number(m[1].replace(",", ".")));
  const de = normalise(m[2]);
  const vers = normalise(m[3]);
  const fDe = famille(de);
  const fVers = famille(vers);
  if (!fDe || !fVers || fDe !== fVers)
    throw new ErreurResolution(
      `On ne peut pas convertir des ${fDe ?? "?"} en ${fVers ?? "?"}.`,
      "Les deux unités doivent mesurer la même grandeur (deux longueurs, deux masses…).",
    );

  const facteur = TABLE[fDe].unités[de] / TABLE[fVers].unités[vers];
  const résultat = valeur.valeur * facteur;
  const e = new Etapes();
  e.ajoute(
    "Identifier la grandeur",
    `${de} et ${vers} mesurent une ${fDe === "capacite" ? "capacité" : fDe}. La conversion est donc possible.`,
    `${valeur.déc()} ${de} → ? ${vers}`,
  );
  e.ajoute(
    "Trouver le facteur de conversion",
    facteur >= 1
      ? `1 ${de} vaut ${formate(facteur)} ${vers} : l'unité d'arrivée est plus petite, donc le nombre augmente.`
      : `1 ${de} vaut ${formate(facteur)} ${vers} : l'unité d'arrivée est plus grande, donc le nombre diminue.`,
    `1 ${de} = ${formate(facteur)} ${vers}`,
  );
  e.ajoute(
    "Multiplier",
    "On multiplie la valeur de départ par le facteur trouvé.",
    `${valeur.déc()} × ${formate(facteur)} = ${formate(résultat)} ${vers}`,
  );
  if (fDe === "longueur" || fDe === "masse" || fDe === "capacite")
    e.ajoute(
      "Astuce du tableau",
      "Chaque colonne du tableau de conversion vaut un facteur 10 : on décale la virgule d'un cran par colonne.",
      `${formate(résultat)} ${vers}`,
    );

  return {
    type: "conversion_unite",
    énoncé,
    réponse: `${formate(résultat)} ${vers}`,
    étapes: e.tableau,
    méthode: "Méthode : valeur × (valeur de l'unité de départ / valeur de l'unité d'arrivée).",
  };
}

const formate = (x: number): string => {
  if (Number.isInteger(x)) return String(x);
  const s = x.toPrecision(10).replace(/0+$/, "").replace(/\.$/, "");
  return String(Number(s));
};

export const UNITES_CONNUES = UNITES;
