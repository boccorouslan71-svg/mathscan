"use client";
/**
 * Écran d'accueil : scan, import galerie, quota du jour, accès historique/premium,
 * message d'onboarding affiché une seule fois (disclaimer pédagogique).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { etatQuota, litReglage, écritReglage, type EtatQuota } from "@/lib/db";

export default function Accueil() {
  const { t, langue, change } = useLangue();
  const router = useRouter();
  const [quota, setQuota] = useState<EtatQuota | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [défi, setDéfi] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setQuota(await etatQuota());
      if ((await litReglage("onboarding_vu", "0")) !== "1") setOnboarding(true);
      // Lien « Défie un ami » : on préremplit l'énoncé reçu
      const d = new URLSearchParams(location.search).get("defi");
      if (d) setDéfi(d);
    })();
  }, []);

  /** Import galerie : on passe l'image à l'écran de capture pour le recadrage. */
  const importe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      sessionStorage.setItem("mathscan:image", String(lecteur.result));
      router.push("/scan?source=import");
    };
    lecteur.readAsDataURL(f);
  };

  const épuisé = quota && !quota.premium && quota.restants <= 0;

  return (
    <main className="min-h-dvh px-4 pb-10">
      <Entete titre={t("titre")} langue={langue} onLangue={change} retour={false} />

      <section className="mt-6">
        <h2 className="text-3xl font-extrabold leading-tight">{t("accroche")}</h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-400">
          <span className="chip bg-accent-400/15 text-accent-500">✈︎ {t("hors_ligne_ok")}</span>
        </p>
      </section>

      {défi && (
        <div className="card mt-5 border-brand-300/40 bg-brand-50 dark:bg-brand-700/20">
          <p className="text-xs font-semibold uppercase text-brand-500">Défi reçu</p>
          <p className="mt-1 text-sm">{défi}</p>
          <button
            className="btn-ghost mt-3 w-full"
            onClick={() => {
              sessionStorage.setItem("mathscan:texte", défi);
              router.push("/traitement?source=texte");
            }}
          >
            Relever le défi
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          className="btn-primary w-full text-lg"
          onClick={() => router.push(épuisé ? "/premium" : "/scan")}
        >
          📷 {t("scanner")}
        </button>
        <button className="btn-ghost w-full" onClick={() => (épuisé ? router.push("/premium") : fichier.current?.click())}>
          🖼️ {t("importer")}
        </button>
        <input
          ref={fichier}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={importe}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/historique" className="card text-center font-semibold">
          🕘 {t("historique")}
        </Link>
        <Link href="/premium" className="card text-center font-semibold">
          ⚡ {t("premium")}
        </Link>
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {quota?.premium
              ? t("illimite")
              : `${quota ? quota.restants : "—"} ${t("scans_restants")}`}
          </p>
          {!quota?.premium && (
            <p className="text-xs text-ink-400">
              {quota ? `${quota.utilisés}/${quota.limite}` : ""} — {t("quota_epuise")} → {t("passer_premium")}
            </p>
          )}
        </div>
        {!quota?.premium && (
          <Link href="/premium" className="chip bg-brand-500 text-white">
            ⚡
          </Link>
        )}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-400">{t("disclaimer")}</p>

      {onboarding && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4">
          <div className="card w-full">
            <h3 className="text-lg font-bold">MathScan</h3>
            <p className="mt-2 text-sm leading-relaxed">{t("disclaimer")}</p>
            <ul className="mt-3 space-y-1 text-sm text-ink-400">
              <li>• Les étapes sont toujours affichées, pas seulement la réponse.</li>
              <li>• Tout est calculé sur ton téléphone, sans internet.</li>
              <li>• Tes exercices restent sur ton appareil.</li>
            </ul>
            <button
              className="btn-primary mt-4 w-full"
              onClick={async () => {
                await écritReglage("onboarding_vu", "1");
                setOnboarding(false);
              }}
            >
              {t("compris")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
