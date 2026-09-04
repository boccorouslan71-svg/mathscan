/**
 * Pourcentages : les 5 formes réellement rencontrées en devoir.
 *  1. « 15% de 240 »
 *  2. « augmenter / diminuer 240 de 15% »
 *  3. « 36 est quel pourcentage de 240 »
 *  4. « le prix passe de 240 à 276 » (taux de variation)
 *  5. « après une hausse de 15%, le prix est 276 » (valeur initiale)
 */
import { Rat, R } from "./rational";
import { ErreurResolution, Etapes, type Solution } from "./types";

const nb = (s: string): number => Number(s.replace(/\s/g, "").replace(",", "."));
const N = "([0-9]+(?:[.,][0-9]+)?)";

export function resoutPourcentage(énoncé: string): Solution {
  const t = énoncé
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/pour ?cent/g, "%")
    .trim();
  const e = new Etapes();

  // 4. Variation entre deux valeurs
  let m = t.match(
    new RegExp(`(?:passe|passer|augmente|baisse|diminue|revient)\\s*(?:de\\s*)?${N}\\s*(?:€|f|fcfa|\\$|frs?)?\\s*(?:à|a|au|jusqu'à)\\s*${N}`),
  );
  if (m) {
    const [v0, v1] = [R(nb(m[1])), R(nb(m[2]))];
    const écart = v1.moins(v0);
    const taux = écart.div(v0).fois(R(100));
    e.ajoute("Repérer les deux valeurs", "Valeur de départ et valeur d'arrivée.", `départ = ${v0.déc()} ; arrivée = ${v1.déc()}`);
    e.ajoute("Calculer l'écart", "On soustrait la valeur de départ de la valeur d'arrivée.", `${v1.déc()} − ${v0.déc()} = ${écart.déc()}`);
    e.ajoute(
      "Diviser par la valeur de départ",
      "Un pourcentage de variation se calcule toujours par rapport à la valeur de DÉPART.",
      `${écart.déc()} / ${v0.déc()} = ${écart.div(v0).déc(4)}`,
    );
    e.ajoute("Convertir en pourcentage", "On multiplie par 100.", `${taux.déc(2)} %`);
    return fin(énoncé, `${taux.valeur > 0 ? "+" : ""}${taux.déc(2)} %`, e, "Méthode : (arrivée − départ) / départ × 100.");
  }

  // 5. Valeur initiale connaissant la valeur finale et le taux
  m = t.match(new RegExp(`apr[eè]s une (hausse|augmentation|baisse|r[eé]duction|remise) de ${N}\\s*%[^0-9]*${N}`));
  if (m) {
    const sens = /hausse|augmentation/.test(m[1]) ? 1 : -1;
    const taux = R(nb(m[2]), 100);
    const finale = R(nb(m[3]));
    const coefTotal = R(1).plus(taux.fois(R(sens)));
    const initiale = finale.div(coefTotal);
    e.ajoute("Identifier le coefficient", `Une ${sens > 0 ? "hausse" : "baisse"} de ${nb(m[2])}% multiplie par ${coefTotal.déc(4)}.`, `coefficient = ${coefTotal.déc(4)}`);
    e.ajoute("Remonter à la valeur de départ", "La valeur finale = valeur initiale × coefficient, donc on divise.", `${finale.déc()} / ${coefTotal.déc(4)} = ${initiale.déc(2)}`);
    return fin(énoncé, `valeur initiale = ${initiale.déc(2)}`, e, "Méthode : valeur initiale = valeur finale / coefficient multiplicateur.");
  }

  // 2. Augmentation / diminution
  // Le séparateur entre les deux nombres doit contenir au moins un caractère non
  // numérique, sinon « 15% » se ferait découper en « 1 » puis « 5 » par backtracking.
  m = t.match(new RegExp(`(augment\\w*|hausse|major\\w*|diminu\\w*|baisse|r[eé]duit\\w*|remise|solde)[^0-9]*${N}[^0-9%]+(?:de\\s*)?${N}\\s*%`));
  const m2 = t.match(new RegExp(`${N}[^0-9]*(augment\\w*|hausse|major\\w*|diminu\\w*|baisse|r[eé]duit\\w*|remise|solde)[^0-9]*de\\s*${N}\\s*%`));
  if (m || m2) {
    const sensTxt = m ? m[1] : m2![2];
    const base = R(nb(m ? m[2] : m2![1]));
    const taux = R(nb(m ? m[3] : m2![3]), 100);
    const sens = /diminu|baisse|r[eé]duit|remise|solde/.test(sensTxt) ? -1 : 1;
    const montant = base.fois(taux);
    const total = base.plus(montant.fois(R(sens)));
    e.ajoute("Calculer le montant du pourcentage", `${taux.fois(R(100)).déc()}% de ${base.déc()} = ${base.déc()} × ${taux.déc(4)}.`, `${montant.déc(2)}`);
    e.ajoute(
      sens > 0 ? "Ajouter au prix de départ" : "Retirer du prix de départ",
      sens > 0 ? "Une augmentation s'ajoute à la valeur initiale." : "Une réduction se soustrait de la valeur initiale.",
      `${base.déc()} ${sens > 0 ? "+" : "−"} ${montant.déc(2)} = ${total.déc(2)}`,
    );
    e.ajoute(
      "Astuce (coefficient multiplicateur)",
      `Plus rapide : multiplier directement par ${R(1).plus(taux.fois(R(sens))).déc(4)}.`,
      `${base.déc()} × ${R(1).plus(taux.fois(R(sens))).déc(4)} = ${total.déc(2)}`,
    );
    return fin(énoncé, `${total.déc(2)}`, e, "Méthode : montant = base × taux, puis on ajoute ou on retire.");
  }

  // 3. « X est quel pourcentage de Y »
  m = t.match(new RegExp(`${N}[^0-9]*(?:quel|combien|quelle proportion|quel pourcentage)[^0-9]*${N}`)) ||
      t.match(new RegExp(`(?:quel pourcentage|quelle proportion)[^0-9]*${N}[^0-9]*de\\s*${N}`));
  if (m) {
    const a = R(nb(m[1]));
    const b = R(nb(m[2]));
    const p = a.div(b).fois(R(100));
    e.ajoute("Poser la proportion", "On divise la partie par le tout.", `${a.déc()} / ${b.déc()} = ${a.div(b).déc(4)}`);
    e.ajoute("Convertir en pourcentage", "On multiplie par 100.", `${p.déc(2)} %`);
    return fin(énoncé, `${p.déc(2)} %`, e, "Méthode : partie / tout × 100.");
  }

  // 1. « X% de Y »
  m = t.match(new RegExp(`${N}\\s*%\\s*(?:de|sur|d')\\s*${N}`));
  if (m) {
    const taux = R(nb(m[1]), 100);
    const base = R(nb(m[2]));
    const r = base.fois(taux);
    e.ajoute("Traduire le pourcentage en fraction", `${nb(m[1])}% signifie ${nb(m[1])}/100.`, `${nb(m[1])}/100 = ${taux.déc(4)}`);
    e.ajoute("Multiplier par la valeur totale", "« de » veut dire « multiplié par ».", `${base.déc()} × ${taux.déc(4)} = ${r.déc(2)}`);
    return fin(énoncé, `${r.déc(2)}`, e, "Méthode : p% de N = N × p / 100.");
  }

  throw new ErreurResolution(
    "Je reconnais un exercice de pourcentage mais pas sa forme exacte.",
    "Reformule par exemple en « 15% de 240 », « 240 augmenté de 15% » ou « le prix passe de 240 à 276 ».",
  );
}

const fin = (énoncé: string, réponse: string, e: Etapes, méthode: string): Solution => ({
  type: "pourcentage",
  énoncé,
  réponse,
  étapes: e.tableau,
  méthode,
});
