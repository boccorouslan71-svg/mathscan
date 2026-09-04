"use client";
/**
 * Écran de capture : aperçu caméra (ou image importée), recadrage manuel de la zone
 * à scanner et contrôle de netteté avant d'envoyer l'image à l'OCR.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Entete } from "@/components/Entete";
import { useLangue } from "@/lib/i18n";
import { FLOU_SEUIL, chargeImage, prépare, recadre, scoreNettete, type Zone } from "@/lib/image";

export default function Scan() {
  const { t } = useLangue();
  const router = useRouter();
  const vidéo = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [flou, setFlou] = useState<number | null>(null);
  const [erreurCam, setErreurCam] = useState<string | null>(null);
  const conteneur = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Image importée depuis l'accueil
  useEffect(() => {
    const importée = sessionStorage.getItem("mathscan:image");
    if (importée && new URLSearchParams(location.search).get("source") === "import") {
      setPhoto(importée);
      return;
    }
    let flux: MediaStream | null = null;
    (async () => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        });
        if (vidéo.current) {
          vidéo.current.srcObject = flux;
          await vidéo.current.play();
        }
      } catch {
        setErreurCam(
          "Accès caméra refusé ou indisponible. Utilise « Importer une image » depuis l'accueil.",
        );
      }
    })();
    return () => flux?.getTracks().forEach((p) => p.stop());
  }, []);

  /** Capture la frame courante en dataURL. */
  const capture = () => {
    const v = vidéo.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setPhoto(c.toDataURL("image/jpeg", 0.92));
  };

  // Analyse de netteté + zone de recadrage par défaut (80% centrés)
  useEffect(() => {
    if (!photo) return;
    (async () => {
      const img = await chargeImage(photo);
      setDims({ w: img.width, h: img.height });
      setZone({ x: img.width * 0.08, y: img.height * 0.28, w: img.width * 0.84, h: img.height * 0.44 });
      const c = document.createElement("canvas");
      const ratio = 600 / img.width;
      c.width = 600;
      c.height = Math.round(img.height * ratio);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setFlou(scoreNettete(c));
    })();
  }, [photo]);

  /** Déplacement/dimensionnement de la zone au doigt. */
  const pointeur = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      if (!zone || !conteneur.current) return;
      const rect = conteneur.current.getBoundingClientRect();
      const échelle = dims.w / rect.width;
      if (e.type === "pointerdown") {
        drag.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (e.type === "pointerup" || !drag.current) {
        drag.current = null;
        return;
      }
      const dx = (e.clientX - drag.current.x) * échelle;
      const dy = (e.clientY - drag.current.y) * échelle;
      drag.current = { x: e.clientX, y: e.clientY };
      setZone((z) => {
        if (!z) return z;
        if (mode === "move")
          return {
            ...z,
            x: Math.max(0, Math.min(dims.w - z.w, z.x + dx)),
            y: Math.max(0, Math.min(dims.h - z.h, z.y + dy)),
          };
        return {
          ...z,
          w: Math.max(60, Math.min(dims.w - z.x, z.w + dx)),
          h: Math.max(60, Math.min(dims.h - z.y, z.h + dy)),
        };
      });
    },
    [zone, dims],
  );

  /** Recadre, prétraite, puis passe à l'écran de traitement. */
  const valide = async () => {
    if (!photo || !zone) return;
    const img = await chargeImage(photo);
    const canvas = prépare(recadre(img, zone));
    sessionStorage.setItem("mathscan:image", canvas.toDataURL("image/png"));
    router.push("/traitement");
  };

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <main className="min-h-dvh px-4 pb-24">
      <Entete titre={t("capture")} />
      {erreurCam && !photo && <p className="card mt-4 text-sm">{erreurCam}</p>}

      {!photo && (
        <>
          <div className="mt-4 overflow-hidden rounded-xl2 bg-black">
            <video ref={vidéo} playsInline muted className="h-[60dvh] w-full object-cover" />
          </div>
          <p className="mt-3 text-center text-xs text-ink-400">
            Cadre un seul exercice, bien à plat, avec de la lumière.
          </p>
          <button className="btn-primary fixed inset-x-4 bottom-6 mx-auto max-w-md" onClick={capture}>
            {t("prendre_photo")}
          </button>
        </>
      )}

      {photo && zone && (
        <>
          <p className="mt-3 text-sm font-semibold">{t("recadrer")}</p>
          <div ref={conteneur} className="relative mt-2 select-none overflow-hidden rounded-xl2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Exercice scanné" className="w-full" />
            <div
              className="absolute border-2 border-accent-400 bg-accent-400/10"
              style={{ left: pct(zone.x, dims.w), top: pct(zone.y, dims.h), width: pct(zone.w, dims.w), height: pct(zone.h, dims.h) }}
              onPointerDown={(e) => pointeur(e, "move")}
              onPointerMove={(e) => pointeur(e, "move")}
              onPointerUp={(e) => pointeur(e, "move")}
            >
              <span
                className="absolute -bottom-3 -right-3 h-7 w-7 rounded-full border-2 border-white bg-accent-500"
                onPointerDown={(e) => pointeur(e, "resize")}
                onPointerMove={(e) => pointeur(e, "resize")}
                onPointerUp={(e) => pointeur(e, "resize")}
              />
            </div>
          </div>

          {flou !== null && flou < FLOU_SEUIL && (
            <p className="card mt-3 border-amber-400/40 bg-amber-50 text-sm dark:bg-amber-500/10">
              ⚠️ {t("photo_floue")}
            </p>
          )}

          <div className="fixed inset-x-4 bottom-6 mx-auto flex max-w-md gap-3">
            <button
              className="btn-ghost flex-1"
              onClick={() => {
                setPhoto(null);
                setFlou(null);
              }}
            >
              {t("reprendre")}
            </button>
            <button className="btn-primary flex-1" onClick={valide}>
              {t("valider")}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
