"use client";
/** Barre d'en-tête commune : retour, titre, bascule thème et langue. */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Langue } from "@/lib/i18n";

export function Entete({
  titre,
  langue,
  onLangue,
  retour = true,
}: {
  titre: string;
  langue?: Langue;
  onLangue?: (l: Langue) => void;
  retour?: boolean;
}) {
  const router = useRouter();
  const [sombre, setSombre] = useState(false);

  useEffect(() => {
    setSombre(document.documentElement.classList.contains("dark"));
  }, []);

  const bascule = () => {
    const next = !sombre;
    setSombre(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mathscan:theme", next ? "sombre" : "clair");
  };

  return (
    <header className="flex items-center gap-2 px-4 pb-2 pt-4">
      {retour && (
        <button
          aria-label="Retour"
          onClick={() => router.back()}
          className="rounded-full bg-black/5 px-3 py-2 text-lg dark:bg-white/10"
        >
          ←
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-bold">{titre}</h1>
      {langue && onLangue && (
        <button
          onClick={() => onLangue(langue === "fr" ? "en" : "fr")}
          className="rounded-full bg-black/5 px-3 py-2 text-xs font-bold uppercase dark:bg-white/10"
        >
          {langue}
        </button>
      )}
      <button
        aria-label="Thème"
        onClick={bascule}
        className="rounded-full bg-black/5 px-3 py-2 dark:bg-white/10"
      >
        {sombre ? "☀️" : "🌙"}
      </button>
    </header>
  );
}
