"use client";
/** Historique local : liste, filtre par type, favoris, suppression. 100% IndexedDB. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { historique, supprime, basculeFavori, type Exercice } from "@/lib/db";
import { LIBELLES, type TypeExercice } from "@/lib/solvers";

export default function Historique() {
  const { t, langue } = useLangue();
  const [liste, setListe] = useState<Exercice[]>([]);
  const [filtre, setFiltre] = useState<TypeExercice | "tous" | "favoris">("tous");

  const recharge = async () => setListe(await historique());
  useEffect(() => {
    void recharge();
  }, []);

  const visibles = liste.filter((e) =>
    filtre === "tous" ? true : filtre === "favoris" ? e.favori === 1 : e.type === filtre,
  );
  const types = [...new Set(liste.map((e) => e.type))];

  return (
    <main className="min-h-dvh px-4 pb-10">
      <Entete titre={t("historique")} />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {(["tous", "favoris", ...types] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f as typeof filtre)}
            className={`chip shrink-0 border ${
              filtre === f
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5"
            }`}
          >
            {f === "tous" ? "Tous" : f === "favoris" ? `★ ${t("favoris")}` : LIBELLES[f as TypeExercice][langue]}
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className="card mt-4 text-sm text-ink-400">{t("vide_historique")}</p>}

      <ul className="mt-2 space-y-3">
        {visibles.map((e) => (
          <li key={e.id} className="card flex gap-3">
            {e.vignette && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.vignette} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            <Link href={`/resultat?id=${e.id}`} className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-brand-500">{LIBELLES[e.type][langue]}</p>
              <p className="truncate font-mono text-sm">{e.énoncé}</p>
              <p className="truncate text-sm font-bold">{e.réponse}</p>
              <p className="mt-1 text-[11px] text-ink-400">
                {new Date(e.créé).toLocaleString(langue === "fr" ? "fr-FR" : "en-GB")}
              </p>
            </Link>
            <div className="flex flex-col gap-1">
              <button
                aria-label="Favori"
                className="rounded-lg px-2 py-1"
                onClick={async () => {
                  await basculeFavori(e.id!);
                  void recharge();
                }}
              >
                {e.favori ? "★" : "☆"}
              </button>
              <button
                aria-label={t("supprimer")}
                className="rounded-lg px-2 py-1 text-ink-400"
                onClick={async () => {
                  await supprime(e.id!);
                  void recharge();
                }}
              >
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
