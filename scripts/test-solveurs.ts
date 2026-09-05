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
  // Priorités des opérations — tous ces cas viennent de la photo de cahier réelle
  // envoyée par l'utilisateur. Le « ÷ » y est rétabli par géométrie (lib/glyphes.ts)
  // et le « × » par normalisation, ces cas verrouillent donc les deux corrections.
  { énoncé: "25 + 37 =", type: "arithmetique", attendu: "62" },
  { énoncé: "84 - 19 =", type: "arithmetique", attendu: "65" },
  { énoncé: "45 × 6 =", type: "arithmetique", attendu: "270" },
  { énoncé: "72 ÷ 8 =", type: "arithmetique", attendu: "9" },
  { énoncé: "120 + 45 - 38 =", type: "arithmetique", attendu: "127" },
  { énoncé: "144 ÷ 12 × 5 =", type: "arithmetique", attendu: "60" },
  { énoncé: "18 + 6 × 4 =", type: "arithmetique", attendu: "42" },
  // Le cas de référence : lu « 90 - 15 + 3 » avant correction, il rendait 78.
  { énoncé: "90 - 15 ÷ 3 =", type: "arithmetique", attendu: "85" },
  { énoncé: "(32 - 12) × 3 =", type: "arithmetique", attendu: "60" },
  { énoncé: "48 ÷ (6 + 2) =", type: "arithmetique", attendu: "6" },
  { énoncé: "A = 7 × (3 + 5)", type: "arithmetique", attendu: "A = 56" },
  { énoncé: "B = 80 - 4 × (6 - 2)", type: "arithmetique", attendu: "B = 64" },
  // Multiplication écrite avec la lettre x, telle que l'OCR la rend toujours
  { énoncé: "18 + 6 x 4 =", type: "arithmetique", attendu: "42" },
  { énoncé: "(32 - 12) X 3 =", type: "arithmetique", attendu: "60" },
  // Priorité réellement respectée, et non un simple enchaînement de gauche à droite
  { énoncé: "2 + 3 × 4 =", type: "arithmetique", attendu: "14" },
  { énoncé: "100 ÷ 4 ÷ 5 =", type: "arithmetique", attendu: "5" },
  { énoncé: "10 - 2 - 3 =", type: "arithmetique", attendu: "5" },
  // Résidus de cadrage serré, tels que l'OCR les rend réellement en production :
  // étiquette dont la lettre est coupée, et pointillés de réponse lus comme un mot.
  { énoncé: ") 18 + 6 * 4 = cen", type: "arithmetique", attendu: "42" },
  { énoncé: "d) 72 ÷ 8 = ee", type: "arithmetique", attendu: "9" },
  { énoncé: "e) 120 + 45 - 38 = eee", type: "arithmetique", attendu: "127" },
  // Série d'opérations — photo de la PAGE ENTIÈRE. Les deux cas ci-dessous sont le texte
  // OCR réel remonté par l'utilisateur depuis la production : plusieurs exercices par
  // ligne, étiquettes en milieu de ligne, et blancs de réponse lus comme des mots
  // (« ween », « eens », « eee », « …-- »). Avant correction, ces résidus passaient pour
  // des inconnues et l'app annonçait « Système de 2 équations » à 95 %.
  {
    énoncé:
      ". Effectuer les opérations suivantes\n25 + 37 = ween b) 84 - 19 = eens c) 45 * 6 =\n72 / 8 = eee e) 120 + 45 - 38 = …-- f) 144 / 12 * 5 =",
    type: "liste_exercices",
    attendu: /a\) 62.*b\) 65.*c\) 270.*d\) 9.*e\) 127.*f\) 60/,
  },
  {
    énoncé:
      "Effectuer les opérations suivantes\na) 25 + 37 = ween b) 84 - 19 = eens c) 45 × 6 =\nd) 72 ÷ 8 = eee e) 120 + 45 - 38 = …-- f) 144 ÷ 12 × 5 =",
    type: "liste_exercices",
    attendu: /a\) 62.*b\) 65.*c\) 270.*d\) 9.*e\) 127.*f\) 60/,
  },
  // Une série dont un calcul est illisible doit tout de même rendre les autres réponses.
  {
    énoncé: "a) 12 + 5 =\nb) 8 ) ) 3 =\nc) 20 - 4 =",
    type: "liste_exercices",
    attendu: /a\) 17.*c\) 16/,
  },
  // Un système d'équations reste un système : ses lignes contiennent des lettres,
  // donc la série ne doit pas les capter (non-régression sur la famille voisine).
  { énoncé: "3x + 2y = 8\nx - y = 1", type: "systeme_2x2", attendu: "x = 2 ; y = 1" },
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
