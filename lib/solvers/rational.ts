/**
 * Arithmétique rationnelle exacte (fractions).
 * Indispensable : un élève doit lire « x = 3/2 », pas « x = 1.4999999999 ».
 * Tout le moteur calcule en rationnels et n'arrondit qu'à l'affichage.
 */

const pgcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export class Rat {
  readonly n: number; // numérateur (porte le signe)
  readonly d: number; // dénominateur (toujours > 0)

  constructor(n: number, d = 1) {
    if (d === 0) throw new Error("Division par zéro");
    if (!Number.isFinite(n) || !Number.isFinite(d)) throw new Error("Nombre non fini");
    // On ramène des décimaux éventuels à des entiers (0.25 -> 1/4)
    let k = 1;
    while (!Number.isInteger(n * k) || !Number.isInteger(d * k)) {
      k *= 10;
      if (k > 1e12) break;
    }
    n = Math.round(n * k);
    d = Math.round(d * k);
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = pgcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static de(x: number | Rat): Rat {
    return x instanceof Rat ? x : new Rat(x);
  }
  plus(o: Rat): Rat {
    return new Rat(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  moins(o: Rat): Rat {
    return new Rat(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  fois(o: Rat): Rat {
    return new Rat(this.n * o.n, this.d * o.d);
  }
  div(o: Rat): Rat {
    if (o.n === 0) throw new Error("Division par zéro");
    return new Rat(this.n * o.d, this.d * o.n);
  }
  puiss(k: number): Rat {
    if (!Number.isInteger(k)) throw new Error("Exposant non entier");
    if (k < 0) return new Rat(this.d ** -k, this.n ** -k);
    return new Rat(this.n ** k, this.d ** k);
  }
  oppose(): Rat {
    return new Rat(-this.n, this.d);
  }
  get estEntier(): boolean {
    return this.d === 1;
  }
  get valeur(): number {
    return this.n / this.d;
  }
  estNul(): boolean {
    return this.n === 0;
  }
  egal(o: Rat | number): boolean {
    const r = Rat.de(o);
    return this.n === r.n && this.d === r.d;
  }
  /** Affichage exact : entier, ou fraction irréductible. */
  toString(): string {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
  /** Affichage décimal arrondi (pour les résultats de mesure : aires, %, conversions). */
  déc(chiffres = 2): string {
    const v = this.valeur;
    if (Number.isInteger(v)) return String(v);
    return String(Number(v.toFixed(chiffres)));
  }
  /** Forme mixte « 7/2 = 3 + 1/2 », utilisée dans les explications sur les fractions. */
  mixte(): string | null {
    if (this.d === 1 || Math.abs(this.n) < this.d) return null;
    const ent = Math.trunc(this.n / this.d);
    const reste = Math.abs(this.n % this.d);
    return `${ent} + ${reste}/${this.d}`;
  }
}

export const R = (n: number, d = 1) => new Rat(n, d);
/** Racine carrée exacte si possible, sinon valeur décimale (avec drapeau). */
export function racine(r: Rat): { exact: boolean; texte: string; valeur: number } {
  const v = r.valeur;
  const s = Math.sqrt(v);
  const sn = Math.sqrt(r.n);
  const sd = Math.sqrt(r.d);
  if (Number.isInteger(sn) && Number.isInteger(sd)) {
    return { exact: true, texte: new Rat(sn, sd).toString(), valeur: s };
  }
  return { exact: false, texte: String(Number(s.toFixed(4))), valeur: s };
}
