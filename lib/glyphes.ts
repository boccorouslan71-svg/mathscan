/**
 * Reconnaissance de forme des symboles d'opération, par géométrie des pixels.
 *
 * POURQUOI CE MODULE EXISTE — mesuré, pas supposé.
 * Sur 48 combinaisons (2 jeux de langues × 3 modes de segmentation × 2 polices ×
 * 4 énoncés), le modèle Tesseract fra/eng n'a JAMAIS lu le glyphe « ÷ », y compris
 * sur du texte rendu parfaitement net. Il le rend en « + », « - » ou « — ». Ce n'est
 * donc ni un défaut de photo ni un défaut de prétraitement : le glyphe est absent du
 * modèle, et aucun réglage d'image ne peut le corriger. Un premier diagnostic avait
 * accusé le prétraitement d'« écraser les petits symboles » — l'expérience l'a
 * réfuté (les 6 variantes de prétraitement échouent toutes de la même façon).
 *
 * CONSÉQUENCE PRODUIT : « 90 - 15 ÷ 3 » devenait « 90 - 15 + 3 », soit 78 au lieu
 * de 85. Une réponse fausse mais plausible est le pire défaut possible pour une app
 * scolaire : l'élève n'a aucun moyen de la détecter.
 *
 * SOLUTION : on n'a pas besoin que le modèle connaisse le glyphe. Tesseract fournit
 * la boîte englobante de chaque symbole ; il suffit de regarder ses pixels. Profil
 * d'encre ligne par ligne :
 *   ÷ → 3 bandes : point étroit, barre large, point étroit
 *   + → 1 seule bande (le trait vertical relie le tout)
 *   - → 1 bande large et plate
 *   = → 2 bandes larges
 *   : → 2 points étroits (pas de barre au milieu)
 * Validé 13/13 avant intégration : 8 glyphes rendus de vérité connue, plus 5 boîtes
 * réelles issues de la photo de cahier de l'utilisateur.
 */

export interface Boite {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Symboles que Tesseract produit à la place d'un « ÷ ». Seuls ceux-là sont réexaminés. */
export const CANDIDATS_DIVISION = new Set(["+", "-", "—", "–", "−", "=", "~", "±", "÷", "+-"]);

/** Niveaux de gris d'un canvas, prêts pour l'analyse de forme. */
export function grisDepuisCanvas(canvas: HTMLCanvasElement): {
  gris: Uint8ClampedArray;
  largeur: number;
  hauteur: number;
} {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: largeur, height: hauteur } = canvas;
  const d = ctx.getImageData(0, 0, largeur, hauteur).data;
  const gris = new Uint8ClampedArray(largeur * hauteur);
  for (let i = 0; i < gris.length; i++)
    gris[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return { gris, largeur, hauteur };
}

/** Regroupe les lignes encrées en bandes verticales contiguës. */
function bandes(encreParLigne: Int32Array, hauteur: number, minEpaisseur: number): [number, number][] {
  const liste: [number, number][] = [];
  let début: number | null = null;
  for (let y = 0; y < hauteur; y++) {
    if (encreParLigne[y] > 0 && début === null) début = y;
    else if (encreParLigne[y] === 0 && début !== null) {
      if (y - début >= minEpaisseur) liste.push([début, y - 1]);
      début = null;
    }
  }
  if (début !== null && hauteur - début >= minEpaisseur) liste.push([début, hauteur - 1]);
  return liste;
}

/**
 * True si les pixels de la boîte dessinent un « ÷ ».
 * Volontairement strict : en cas de doute on rend false et on garde ce que l'OCR a lu.
 * Un faux positif transformerait une addition juste en division fausse — pire que
 * le défaut qu'on corrige.
 */
export function estDivision(
  gris: Uint8ClampedArray,
  largeurImage: number,
  hauteurImage: number,
  boite: Boite,
  seuilEncre = 128,
): boolean {
  const marge = 3;
  const x0 = Math.max(0, boite.x0 - marge);
  const y0 = Math.max(0, boite.y0 - marge);
  const x1 = Math.min(largeurImage - 1, boite.x1 + marge);
  const y1 = Math.min(hauteurImage - 1, boite.y1 + marge);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 6 || h < 6) return false;

  const largeurLigne = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (gris[(y0 + y) * largeurImage + (x0 + x)] < seuilEncre) n++;
    largeurLigne[y] = n;
  }

  const bs = bandes(largeurLigne, h, Math.max(1, Math.floor(h / 20)));
  if (bs.length !== 3) return false;

  const largeurMax = ([a, b]: [number, number]) => {
    let m = 0;
    for (let y = a; y <= b; y++) m = Math.max(m, largeurLigne[y]);
    return m;
  };
  const [l1, l2, l3] = bs.map(largeurMax);
  // La bande du milieu doit être nettement la plus large : c'est la barre.
  if (!(l2 > l1 * 1.5 && l2 > l3 * 1.5)) return false;

  // Les deux points doivent être étroits et centrés horizontalement sous/sur la barre.
  for (const [indice, largeurBande] of [
    [0, l1],
    [2, l3],
  ] as const) {
    if (largeurBande > w * 0.55) return false;
    const [a, b] = bs[indice];
    let min = w;
    let max = -1;
    for (let y = a; y <= b; y++)
      for (let x = 0; x < w; x++)
        if (gris[(y0 + y) * largeurImage + (x0 + x)] < seuilEncre) {
          if (x < min) min = x;
          if (x > max) max = x;
        }
    if (max < 0) return false;
    if (Math.abs((min + max) / 2 - w / 2) > w * 0.3) return false;
  }
  return true;
}
