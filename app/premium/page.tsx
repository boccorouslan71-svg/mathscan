"use client";
/**
 * Écran premium : offre illimitée, lien de paiement Chariow, saisie du code d'activation.
 * L'activation est vérifiée LOCALEMENT (clé de contrôle), donc aucune dépendance serveur
 * après l'achat : le premium reste actif en mode avion.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { SCANS_GRATUITS_PAR_JOUR, activePremium, etatQuota } from "@/lib/db";

/** Lien de vente Chariow — configurable sans toucher au code (variable Vercel). */
const LIEN_CHARIOW = process.env.NEXT_PUBLIC_CHARIOW_URL ?? "https://chariow.com";

function Premium() {
  const { t } = useLangue();
  const params = useSearchParams();
  const [premium, setPremium] = useState(false);
  const [code, setCode] = useState("");
  const [état, setÉtat] = useState<"vide" | "ok" | "ko">("vide");

  useEffect(() => {
    (async () => setPremium((await etatQuota()).premium))();
  }, []);

  const active = async () => {
    const ok = await activePremium(code);
    setÉtat(ok ? "ok" : "ko");
    if (ok) setPremium(true);
  };

  return (
    <main className="min-h-dvh px-4 pb-10">
      <Entete titre={t("premium")} />

      {params.get("quota") === "1" && !premium && (
        <p className="card mt-3 border-amber-400/40 bg-amber-50 text-sm dark:bg-amber-500/10">
          ⚠️ {t("quota_epuise")} — {SCANS_GRATUITS_PAR_JOUR} scans par jour en gratuit. Passe en
          illimité pour continuer aujourd&apos;hui.
        </p>
      )}

      {premium ? (
        <div className="card mt-4 border-accent-400/40 bg-accent-400/10">
          <p className="font-bold">✅ {t("premium_actif")}</p>
          <Link href="/" className="btn-primary mt-4 w-full">
            {t("scanner")}
          </Link>
        </div>
      ) : (
        <>
          <section className="card mt-4">
            <h2 className="text-xl font-extrabold">Scans illimités</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>♾️ Aucune limite quotidienne</li>
              <li>💡 Toutes les explications détaillées</li>
              <li>✈︎ Fonctionne toujours hors connexion</li>
              <li>🕘 Historique et favoris illimités</li>
            </ul>
            <a href={LIEN_CHARIOW} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
              {t("acheter")}
            </a>
            <p className="mt-2 text-center text-xs text-ink-400">
              Paiement sécurisé via Chariow. Tu reçois ton code d&apos;activation juste après l&apos;achat.
            </p>
          </section>

          <section className="card mt-4">
            <label className="text-sm font-semibold" htmlFor="code">
              {t("code_activation")}
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MS-XXXX-XXXX-K"
              autoCapitalize="characters"
              className="mt-2 w-full rounded-xl2 border border-black/10 bg-white p-3 font-mono tracking-wider dark:border-white/10 dark:bg-ink-800"
            />
            <button className="btn-primary mt-3 w-full" onClick={active} disabled={code.length < 8}>
              {t("activer")}
            </button>
            {état === "ko" && <p className="mt-2 text-sm text-red-500">{t("code_invalide")}</p>}
          </section>
        </>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Chargement…</p>}>
      <Premium />
    </Suspense>
  );
}
