"use client";
/**
 * Écran de résultat : énoncé, réponse, étapes détaillées, partage image watermarkée,
 * défi à un ami, mise en favori.
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { basculeFavori, db, type Exercice } from "@/lib/db";
import { LIBELLES, type Solution } from "@/lib/solvers";
import { défie, partage } from "@/lib/share";

function Resultat() {
  const { t, langue } = useLangue();
  const router = useRouter();
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const [ex, setEx] = useState<Exercice | null>(null);
  const [détaillé, setDétaillé] = useState(true);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!Number.isFinite(id)) return;
      setEx((await db.exercices.get(id)) ?? null);
    })();
  }, [id]);

  if (!ex)
    return (
      <main className="min-h-dvh px-4">
        <Entete titre={t("resultat")} />
        <p className="card mt-6 text-sm">
          Résultat introuvable.{" "}
          <Link href="/" className="font-semibold text-brand-500">
            Retour à l&apos;accueil
          </Link>
        </p>
      </main>
    );

  const sol: Solution = {
    type: ex.type,
    énoncé: ex.énoncé,
    réponse: ex.réponse,
    étapes: ex.étapes,
    méthode: ex.méthode,
  };

  return (
    <main className="min-h-dvh px-4 pb-32">
      <Entete titre={LIBELLES[ex.type][langue]} />

      <section className="card mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("enonce")}</p>
        <p className="mt-1 whitespace-pre-wrap font-mono text-sm">{ex.énoncé}</p>
      </section>

      <section className="card mt-3 border-accent-400/40 bg-accent-400/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-500">{t("reponse")}</p>
        <p className="mt-1 whitespace-pre-wrap text-xl font-extrabold">{ex.réponse}</p>
      </section>

      <div className="mt-4 flex rounded-xl2 bg-black/5 p-1 dark:bg-white/10">
        {([true, false] as const).map((mode) => (
          <button
            key={String(mode)}
            onClick={() => setDétaillé(mode)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              détaillé === mode ? "bg-white shadow dark:bg-ink-700" : "text-ink-400"
            }`}
          >
            {mode ? `💡 ${t("explique")}` : `⚡ ${t("rapide")}`}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        <p className="text-sm font-semibold">{t("etapes")}</p>
        {ex.étapes.map((é) => (
          <article key={é.étape} className="card">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                {é.étape}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{é.opération}</p>
                {détaillé && (
                  <p className="mt-1 text-sm leading-relaxed text-ink-400">{é.explication}</p>
                )}
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/5 p-2 font-mono text-sm dark:bg-white/5">
{é.résultat_intermédiaire}
                </pre>
              </div>
            </div>
          </article>
        ))}
        {détaillé && ex.méthode && (
          <p className="rounded-xl2 bg-brand-50 p-3 text-xs leading-relaxed text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
            📘 {ex.méthode}
          </p>
        )}
      </section>

      {info && <p className="mt-4 text-center text-xs text-ink-400">{info}</p>}

      <div className="fixed inset-x-4 bottom-6 mx-auto flex max-w-md gap-2">
        <button
          className="btn-ghost px-4"
          aria-label="Favori"
          onClick={async () => {
            await basculeFavori(ex.id!);
            setEx({ ...ex, favori: ex.favori ? 0 : 1 });
          }}
        >
          {ex.favori ? "★" : "☆"}
        </button>
        <button
          className="btn-primary flex-1"
          onClick={async () => {
            const r = await partage(sol, détaillé);
            setInfo(r === "téléchargé" ? "Image enregistrée dans tes téléchargements." : null);
          }}
        >
          {t("partager")}
        </button>
        <button className="btn-ghost flex-1" onClick={() => défie(sol)}>
          {t("defi")}
        </button>
      </div>

      <button className="sr-only" onClick={() => router.push("/")}>
        {t("retour")}
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Chargement…</p>}>
      <Resultat />
    </Suspense>
  );
}
