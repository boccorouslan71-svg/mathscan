/**
 * Partage : génère une image PNG du résultat (canvas, donc 100% offline) avec
 * watermark discret, puis utilise l'API Web Share si disponible (Android/iOS)
 * ou retombe sur un téléchargement.
 */
import type { Solution } from "./solvers/types";

const L = 1080; // format carré, idéal WhatsApp / Stories

export function imageResultat(sol: Solution, détaillé = true): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = L;
  c.height = 1350; // 4:5, le format le plus lisible en story
  const g = c.getContext("2d")!;

  // Fond dégradé violet -> presque noir (identité visuelle)
  const fond = g.createLinearGradient(0, 0, L, c.height);
  fond.addColorStop(0, "#2a1160");
  fond.addColorStop(1, "#0b0b13");
  g.fillStyle = fond;
  g.fillRect(0, 0, L, c.height);

  let y = 96;
  g.fillStyle = "#b79bff";
  g.font = "bold 42px system-ui, sans-serif";
  g.fillText("MathScan", 72, y);
  y += 70;

  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = "500 30px system-ui, sans-serif";
  g.fillText(sol.type.replace(/_/g, " "), 72, y);
  y += 60;

  // Énoncé
  g.fillStyle = "#ffffff";
  g.font = "bold 46px system-ui, sans-serif";
  y = paragraphe(g, sol.énoncé, 72, y + 20, L - 144, 56);
  y += 30;

  // Réponse encadrée
  g.fillStyle = "rgba(34,211,238,0.14)";
  arrondi(g, 72, y, L - 144, 120, 24);
  g.fill();
  g.fillStyle = "#22d3ee";
  g.font = "bold 44px system-ui, sans-serif";
  g.fillText(tronque(g, sol.réponse, L - 200), 104, y + 76);
  y += 170;

  // Étapes (limitées à ce qui tient dans l'image)
  if (détaillé) {
    g.font = "500 30px system-ui, sans-serif";
    for (const é of sol.étapes) {
      if (y > c.height - 220) break;
      g.fillStyle = "#b79bff";
      g.fillText(`${é.étape}.`, 72, y);
      g.fillStyle = "rgba(255,255,255,0.92)";
      y = paragraphe(g, é.opération, 128, y, L - 200, 40);
      g.fillStyle = "rgba(255,255,255,0.6)";
      y = paragraphe(g, é.résultat_intermédiaire.split("\n")[0], 128, y + 4, L - 200, 38);
      y += 22;
    }
  }

  // Watermark
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.font = "500 28px system-ui, sans-serif";
  g.fillText("Résolu avec MathScan — scanne, comprends, réussis", 72, c.height - 72);
  return c;
}

function paragraphe(
  g: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  largeur: number,
  interligne: number,
): number {
  for (const ligneSource of texte.split("\n")) {
    let ligne = "";
    for (const mot of ligneSource.split(" ")) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (g.measureText(essai).width > largeur && ligne) {
        g.fillText(ligne, x, y);
        y += interligne;
        ligne = mot;
      } else ligne = essai;
    }
    if (ligne) {
      g.fillText(ligne, x, y);
      y += interligne;
    }
  }
  return y;
}

const tronque = (g: CanvasRenderingContext2D, s: string, max: number): string => {
  let out = s;
  while (g.measureText(out).width > max && out.length > 4) out = out.slice(0, -2);
  return out.length < s.length ? `${out}…` : out;
};

function arrondi(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const enBlob = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((ok) => c.toBlob((b) => ok(b!), "image/png", 0.92));

/** Partage l'image du résultat (WhatsApp, TikTok, Stories… via la feuille système). */
export async function partage(sol: Solution, détaillé = true): Promise<"partagé" | "téléchargé"> {
  const blob = await enBlob(imageResultat(sol, détaillé));
  const fichier = new File([blob], "mathscan.png", { type: "image/png" });
  const texte = `${sol.énoncé}\n→ ${sol.réponse}\nRésolu avec MathScan`;
  if (navigator.canShare?.({ files: [fichier] })) {
    await navigator.share({ files: [fichier], text: texte, title: "MathScan" });
    return "partagé";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mathscan.png";
  a.click();
  URL.revokeObjectURL(url);
  return "téléchargé";
}

/** « Défie un ami » : partage l'énoncé SANS la solution + lien d'invitation. */
export async function défie(sol: Solution): Promise<void> {
  const base = typeof location !== "undefined" ? location.origin : "https://mathscan.app";
  const lien = `${base}/?defi=${encodeURIComponent(sol.énoncé.slice(0, 180))}`;
  const texte = `Tu sais résoudre ça ?\n\n${sol.énoncé}\n\nMoi j'ai la solution 😏 — ${lien}`;
  if (navigator.share) await navigator.share({ text: texte, title: "Défi MathScan" });
  else await navigator.clipboard?.writeText(texte);
}
