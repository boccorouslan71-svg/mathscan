/**
 * Tests du moteur de résolution — exécutable sans navigateur :
 *   bun scripts/test-solveurs.ts
 * Le moteur étant déterministe, chaque cas a une réponse attendue exacte.
 * C'est ce qui garantit qu'aucune régression ne passe : un élève qui rend un
 * mauvais résultat ne revient jamais.
 */
import { classifie } from "../lib/classify";
import { resoutAvecReplis } from "../lib/solvers";

interface Cas {
  énoncé: string;
  type: string;
  attendu: string | RegExp;
}

const CAS: Cas[] = [
  // Équations du 1er degré
  { énoncé: "2x + 3 = 7", type: "equation_lineaire", attendu: "x = 2" },
  { énoncé: "3x - 5 = x + 7", type: "equation_lineaire", attendu: "x = 6" },
  { énoncé: "4x + 2 = 9", type: "equation_lineaire", attendu: /x = 7\/4/ },
  { énoncé: "5(x - 2) = 3x + 4", type: "equation_lineaire", attendu: "x = 7" },
  // Équations du 2nd degré
  { énoncé: "x^2 - 5x + 6 = 0", type: "equation_quadratique", attendu: /x₁ = 3 ; x₂ = 2/ },
  { énoncé: "x^2 + 2x + 1 = 0", type: "equation_quadratique", attendu: /x = -1/ },
  { énoncé: "x^2 + x + 5 = 0", type: "equation_quadratique", attendu: /Aucune solution réelle/ },
  { énoncé: "2x^2 - 8 = 0", type: "equation_quadratique", attendu: /x₁ = 2 ; x₂ = -2/ },
  // Systèmes 2x2
  { énoncé: "x + y = 10\nx - y = 2", type: "systeme_2x2", attendu: "x = 6 ; y = 4" },
  { énoncé: "2x + 3y = 12\nx - y = 1", type: "systeme_2x2", attendu: "x = 3 ; y = 2" },
  // Fractions
  { énoncé: "3/4 + 5/6", type: "fraction", attendu: /19\/12/ },
  { énoncé: "2/3 * 9/4", type: "fraction", attendu: /3\/2/ },
  { énoncé: "7/8 - 1/2", type: "fraction", attendu: /3\/8/ },
  // Pourcentages
  { énoncé: "15% de 240", type: "pourcentage", attendu: "36" },
  { énoncé: "Un article à 240 F subit une remise de 15%", type: "pourcentage", attendu: "204" },
  { énoncé: "Le prix passe de 240 à 276", type: "pourcentage", attendu: /\+15 %/ },
  // Géométrie
  { énoncé: "Aire d'un rectangle de longueur 8 cm et de largeur 5 cm", type: "geometrie", attendu: /Aire = 40 cm²/ },
  { énoncé: "Périmètre d'un carré de côté 7 m", type: "geometrie", attendu: /Périmètre = 28 m/ },
  { énoncé: "Aire d'un triangle de base 6 cm et de hauteur 4 cm", type: "geometrie", attendu: /Aire = 12 cm²/ },
  { énoncé: "Aire d'un cercle de rayon 3 cm", type: "geometrie", attendu: /28\.27/ },
  // Dérivées
  { énoncé: "Dérivée de 3x^2 + 2x - 5", type: "derivee", attendu: /f'\(x\) = 6x \+ 2/ },
  { énoncé: "Dérivée de x^3 - 4x", type: "derivee", attendu: /3x\^2 - 4/ },
  // Conversions
  { énoncé: "Convertis 2,5 km en m", type: "conversion_unite", attendu: "2500 m" },
  { énoncé: "750 ml en l", type: "conversion_unite", attendu: "0.75 l" },
  { énoncé: "Convertis 3 h en min", type: "conversion_unite", attendu: "180 min" },
];

let ok = 0;
const échecs: string[] = [];

for (const cas of CAS) {
  const c = classifie(cas.énoncé);
  try {
    const sol = resoutAvecReplis([c.type, ...c.replis], c.données.texte_normalisé);
    const bonType = sol.type === cas.type;
    const bonneRéponse =
      typeof cas.attendu === "string" ? sol.réponse.includes(cas.attendu) : cas.attendu.test(sol.réponse);
    if (bonType && bonneRéponse && sol.étapes.length > 0) {
      ok++;
      console.log(`✅ ${cas.énoncé.replace(/\n/g, " | ")} → ${sol.réponse}`);
    } else {
      échecs.push(
        `❌ ${cas.énoncé.replace(/\n/g, " | ")}\n   type: ${sol.type} (attendu ${cas.type})\n   réponse: ${sol.réponse} (attendu ${cas.attendu})`,
      );
    }
  } catch (e) {
    échecs.push(`💥 ${cas.énoncé.replace(/\n/g, " | ")} → ${(e as Error).message}`);
  }
}

console.log(`\n${ok}/${CAS.length} cas validés`);
if (échecs.length) {
  console.log(`\n${échecs.join("\n")}`);
  process.exit(1);
}
