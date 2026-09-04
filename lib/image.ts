/**
 * Traitement image côté client : détection de flou, recadrage, prétraitement OCR.
 * Tout se fait sur un <canvas> : aucun upload, aucune dépendance réseau.
 */

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const chargeImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Image illisible"));
    img.src = src;
  });

/**
 * Netteté par variance du Laplacien : mesure standard, très bon marché.
 * Sous ~120 sur une photo de texte, l'OCR devient hasardeux → on demande une reprise.
 */
export function scoreNettete(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gris = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    gris[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let somme = 0;
  let sommeCarrés = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gris[i] + gris[i - 1] + gris[i + 1] + gris[i - w] + gris[i + w];
      somme += lap;
      sommeCarrés += lap * lap;
      n++;
    }
  const moyenne = somme / n;
  return sommeCarrés / n - moyenne * moyenne;
}

export const FLOU_SEUIL = 120;

/** Recadre la zone choisie et redimensionne (l'OCR aime ~1600px de large). */
export function recadre(img: HTMLImageElement, zone: Zone, largeurCible = 1600): HTMLCanvasElement {
  const ratio = Math.min(largeurCible / Math.max(1, zone.w), 3);
  const c = document.createElement("canvas");
  c.width = Math.round(zone.w * ratio);
  c.height = Math.round(zone.h * ratio);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, zone.x, zone.y, zone.w, zone.h, 0, 0, c.width, c.height);
  return c;
}

/**
 * Prétraitement OCR : niveaux de gris + binarisation adaptative légère + renforcement
 * du contraste. Gain net sur les photos de cahier prises en lumière faible.
 */
export function prépare(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // 1. gris
  const gris = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < gris.length; i++)
    gris[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  // 2. seuil global (Otsu simplifié sur histogramme)
  const hist = new Array(256).fill(0);
  gris.forEach((v) => hist[v]++);
  const total = gris.length;
  let sommeTot = 0;
  hist.forEach((c, v) => (sommeTot += c * v));
  let sommeB = 0;
  let poidsB = 0;
  let max = 0;
  let seuil = 128;
  for (let v = 0; v < 256; v++) {
    poidsB += hist[v];
    if (!poidsB) continue;
    const poidsF = total - poidsB;
    if (!poidsF) break;
    sommeB += v * hist[v];
    const moyB = sommeB / poidsB;
    const moyF = (sommeTot - sommeB) / poidsF;
    const variance = poidsB * poidsF * (moyB - moyF) ** 2;
    if (variance > max) {
      max = variance;
      seuil = v;
    }
  }
  // 3. écriture : on garde une marge grise pour ne pas casser les traits fins
  for (let i = 0; i < gris.length; i++) {
    const v = gris[i] > seuil + 15 ? 255 : gris[i] < seuil - 15 ? 0 : gris[i];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Vignette compacte stockée avec l'historique (dataURL JPEG). */
export function vignette(canvas: HTMLCanvasElement, largeur = 220): string {
  const c = document.createElement("canvas");
  const ratio = largeur / canvas.width;
  c.width = largeur;
  c.height = Math.max(1, Math.round(canvas.height * ratio));
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6);
}
