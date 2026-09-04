/**
 * Stockage local (IndexedDB via Dexie) : historique, favoris, quota, statut premium,
 * préférences. Rien ne part sur un serveur : l'app reste utilisable en mode avion
 * et les devoirs de l'élève ne quittent pas son téléphone.
 */
import Dexie, { type Table } from "dexie";
import type { Etape, TypeExercice } from "./solvers/types";

export interface Exercice {
  id?: number;
  créé: number; // timestamp
  type: TypeExercice;
  énoncé: string;
  texte_ocr: string;
  réponse: string;
  étapes: Etape[];
  méthode?: string;
  favori: 0 | 1; // 0/1 car IndexedDB n'indexe pas les booléens
  vignette?: string; // dataURL réduite de la photo scannée
}

export interface Reglage {
  clé: string;
  valeur: string;
}

class BaseMathScan extends Dexie {
  exercices!: Table<Exercice, number>;
  reglages!: Table<Reglage, string>;

  constructor() {
    super("mathscan");
    this.version(1).stores({
      exercices: "++id, créé, type, favori",
      reglages: "clé",
    });
  }
}

export const db = new BaseMathScan();

/* ---------- Réglages génériques ---------- */

export async function litReglage(clé: string, défaut = ""): Promise<string> {
  const r = await db.reglages.get(clé);
  return r?.valeur ?? défaut;
}
export async function écritReglage(clé: string, valeur: string): Promise<void> {
  await db.reglages.put({ clé, valeur });
}

/* ---------- Historique ---------- */

export async function enregistre(ex: Omit<Exercice, "id" | "créé" | "favori">): Promise<number> {
  return db.exercices.add({ ...ex, créé: Date.now(), favori: 0 });
}
export const historique = (limite = 100) =>
  db.exercices.orderBy("créé").reverse().limit(limite).toArray();
export const favoris = () => db.exercices.where("favori").equals(1).reverse().toArray();
export async function basculeFavori(id: number): Promise<void> {
  const ex = await db.exercices.get(id);
  if (ex) await db.exercices.update(id, { favori: ex.favori ? 0 : 1 });
}
export const supprime = (id: number) => db.exercices.delete(id);

/* ---------- Quota gratuit : 3 scans / jour ---------- */

export const SCANS_GRATUITS_PAR_JOUR = 3;
const jourCourant = () => new Date().toLocaleDateString("fr-CA"); // AAAA-MM-JJ, date système locale

export interface EtatQuota {
  premium: boolean;
  utilisés: number;
  restants: number;
  limite: number;
}

export async function etatQuota(): Promise<EtatQuota> {
  const premium = (await litReglage("premium", "0")) === "1";
  const jour = await litReglage("quota_jour", "");
  const utilisés = jour === jourCourant() ? Number(await litReglage("quota_compteur", "0")) : 0;
  if (jour !== jourCourant()) {
    // Nouveau jour : on remet le compteur à zéro
    await écritReglage("quota_jour", jourCourant());
    await écritReglage("quota_compteur", "0");
  }
  return {
    premium,
    utilisés,
    limite: SCANS_GRATUITS_PAR_JOUR,
    restants: premium ? Infinity : Math.max(0, SCANS_GRATUITS_PAR_JOUR - utilisés),
  };
}

/** Consomme un scan. Renvoie false si le quota gratuit est épuisé. */
export async function consommeScan(): Promise<boolean> {
  const q = await etatQuota();
  if (q.premium) return true;
  if (q.restants <= 0) return false;
  await écritReglage("quota_jour", jourCourant());
  await écritReglage("quota_compteur", String(q.utilisés + 1));
  return true;
}

/* ---------- Premium ---------- */

/**
 * Validation du code d'activation. Le contrôle est LOCAL et hors-ligne :
 * le code est signé côté vendeur selon un format vérifiable sans serveur.
 * Format : MS-XXXX-XXXX-K où K est une clé de contrôle (somme mod 36).
 * NEXT_PUBLIC_CODE_SEL permet de changer le sel sans toucher au code.
 */
const SEL = process.env.NEXT_PUBLIC_CODE_SEL ?? "mathscan-v1";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function cléDeControle(corps: string): string {
  let somme = 0;
  const src = (SEL + corps).toUpperCase();
  for (let i = 0; i < src.length; i++) somme += src.charCodeAt(i) * (i + 7);
  return ALPHABET[somme % 36];
}

export function codeValide(code: string): boolean {
  const c = code.trim().toUpperCase().replace(/\s/g, "");
  const m = c.match(/^MS-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9])$/);
  if (!m) return false;
  return cléDeControle(`${m[1]}${m[2]}`) === m[3];
}

/** Active le premium en local (aucune connexion requise ensuite). */
export async function activePremium(code: string): Promise<boolean> {
  if (!codeValide(code)) return false;
  await écritReglage("premium", "1");
  await écritReglage("premium_code", code.trim().toUpperCase());
  await écritReglage("premium_date", new Date().toISOString());
  return true;
}
