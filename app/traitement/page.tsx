"use client";
/**
 * Écran de traitement : OCR → classification → résolution.
 * Le texte reconnu est TOUJOURS affiché et modifiable avant résolution : c'est ce qui
 * fait la fiabilité perçue de l'app (un OCR se trompe, un élève sait corriger).
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { arrête, lisImage } from "@/lib/ocr";
import { classifie, type Classification } from "@/lib/classify";
import { NEEDLE_ACTIF, affine } from "@/lib/classify/needle";
import { resoutAvecReplis, LIBELLES, type Solution } from "@/lib/solvers";
import { consommeScan, enregistre } from "@/lib/db";
import { vignette, chargeImage } from "@/lib/image";

function Traitement() {
  const { t } = useLangue();
  const router = useRouter();
  const [phase, setPhase] = useState<"ocr" | "relecture" | "resolution" | "erreur">("ocr");
  const [avancement, setAvancement] = useState({ label: "Démarrage", ratio: 0 });
  const [texte, setTexte] = useState("");
  const [classe, setClasse] = useState<Classification | null>(null);
  const [erreur, setErreur] = useState<{ msg: string; conseil?: string } | null>(null);
  const image = useRef<string | null>(null);
  const lancé = useRef(false);

  // Étape 1 — OCR (ou texte direct dans le cas d'un défi partagé)
  useEffect(() => {
    if (lancé.current) return;
    lancé.current = true;
    (async () => {
      const direct = sessionStorage.getItem("mathscan:texte");
      if (new URLSearchParams(location.search).get("source") === "texte" && direct) {
        sessionStorage.removeItem("mathscan:texte");
        prépareRelecture(direct);
        return;
      }
      const img = sessionStorage.getItem("mathscan:image");
      if (!img) {
        setErreur({ msg: "Aucune image à traiter.", conseil: "Reprends une photo depuis l'accueil." });
        setPhase("erreur");
        return;
      }
      image.current = img;
      try {
        const r = await lisImage(img, (étape, ratio) => setAvancement({ label: étape, ratio }));
        if (!r.texte) {
          setErreur({
            msg: "Aucun texte lisible détecté.",
            conseil: "Rapproche-toi de la feuille, évite les ombres, puis reprends la photo.",
          });
          setPhase("erreur");
          return;
        }
        prépareRelecture(r.texte);
      } catch (e) {
        // Certaines pannes (worker, WASM, réseau) ne lèvent pas un Error avec
        // .message : sans ce garde-fou l'écran affichait « Lecture impossible :
        // undefined », inutilisable pour l'utilisateur comme pour le diagnostic.
        const détail =
          e instanceof Error && e.message
            ? e.message
            : typeof e === "string" && e
              ? e
              : "le moteur de lecture n'a pas répondu.";
        setErreur({
          msg: `Lecture impossible : ${détail}`,
          conseil: "Le premier scan a besoin d'une connexion pour charger le moteur. Ensuite tout fonctionne hors ligne.",
        });
        setPhase("erreur");
      }
    })();
    return () => {
      void arrête();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prépareRelecture = useCallback(async (brut: string) => {
    let c = classifie(brut);
    if (NEEDLE_ACTIF) {
      // Renfort optionnel : n'écrase les règles que s'il aboutit
      const affiné = await affine(c.données.texte_normalisé, c);
      if (affiné) c = affiné;
    }
    setTexte(c.données.texte_normalisé);
    setClasse(c);
    setPhase("relecture");
  }, []);

  // Étape 3 — Résolution (déterministe, instantanée)
  const résous = async () => {
    setPhase("resolution");
    const c = classifie(texte);
    if (c.type === "inconnu") {
      setErreur({ msg: c.message ?? "Exercice non reconnu.", conseil: "Corrige le texte ci-dessus." });
      setPhase("erreur");
      return;
    }
    if (!(await consommeScan())) {
      router.replace("/premium?quota=1");
      return;
    }
    let sol: Solution;
    try {
      sol = resoutAvecReplis([c.type, ...c.replis], texte);
    } catch (e) {
      const err = e as Error & { conseil?: string };
      setErreur({ msg: err.message, conseil: err.conseil });
      setPhase("erreur");
      return;
    }
    let vig: string | undefined;
    if (image.current) {
      try {
        const img = await chargeImage(image.current);
        const c2 = document.createElement("canvas");
        c2.width = img.width;
        c2.height = img.height;
        c2.getContext("2d")!.drawImage(img, 0, 0);
        vig = vignette(c2);
      } catch {
        /* la vignette est un bonus : on continue sans */
      }
    }
    const id = await enregistre({
      type: sol.type,
      énoncé: sol.énoncé,
      texte_ocr: texte,
      réponse: sol.réponse,
      étapes: sol.étapes,
      méthode: sol.méthode,
      vignette: vig,
    });
    sessionStorage.removeItem("mathscan:image");
    router.replace(`/resultat?id=${id}`);
  };

  return (
    <main className="min-h-dvh px-4 pb-28">
      <Entete titre={t("traitement")} />

      {phase === "ocr" && (
        <div className="mt-10 text-center">
          <div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.round(avancement.ratio * 100)}%` }}
            />
          </div>
          <p className="mt-4 text-sm font-semibold">{avancement.label}</p>
          <p className="mt-1 text-xs text-ink-400">
            Premier lancement : le moteur se télécharge une seule fois, ensuite tout est hors-ligne.
          </p>
        </div>
      )}

      {phase === "relecture" && classe && (
        <>
          <p className="mt-4 text-sm font-semibold">{t("texte_detecte")}</p>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl2 border border-black/10 bg-white p-3 font-mono text-base dark:border-white/10 dark:bg-ink-800"
          />
          <p className="mt-2 text-xs text-ink-400">
            Type détecté :{" "}
            <span className="font-semibold text-brand-500">{LIBELLES[classifie(texte).type].fr}</span>{" "}
            · confiance {Math.round(classifie(texte).confiance * 100)}%
          </p>
          <button className="btn-primary fixed inset-x-4 bottom-6 mx-auto max-w-md" onClick={résous}>
            {t("resoudre")}
          </button>
        </>
      )}

      {phase === "resolution" && <p className="mt-10 text-center text-sm">{t("resolution")}…</p>}

      {phase === "erreur" && erreur && (
        <div className="card mt-6">
          <p className="font-semibold">{erreur.msg}</p>
          {erreur.conseil && <p className="mt-2 text-sm text-ink-400">{erreur.conseil}</p>}
          {texte && (
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl2 border border-black/10 bg-white p-3 font-mono text-sm dark:border-white/10 dark:bg-ink-800"
            />
          )}
          <div className="mt-4 flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => router.replace("/scan")}>
              {t("reprendre")}
            </button>
            <button className="btn-primary flex-1" onClick={résous} disabled={!texte}>
              {t("reessayer")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Chargement…</p>}>
      <Traitement />
    </Suspense>
  );
}
