"use client";
/**
 * Internationalisation minimaliste FR/EN (aucune dépendance : la langue est un
 * simple dictionnaire en mémoire + localStorage, donc disponible hors-ligne).
 * Le moteur de résolution reste francophone pour les explications V1 ; le passage
 * complet des explications en EN est prévu avec les mêmes clés (voir README).
 */
import { useCallback, useEffect, useState } from "react";

export type Langue = "fr" | "en";

const DICO = {
  fr: {
    titre: "MathScan",
    accroche: "Scanne ton exercice, comprends la solution.",
    hors_ligne_ok: "Fonctionne sans internet",
    scanner: "Scanner un exercice",
    importer: "Importer une image",
    historique: "Historique",
    favoris: "Favoris",
    premium: "Premium",
    scans_restants: "scans restants aujourd'hui",
    illimite: "Scans illimités",
    quota_epuise: "Quota du jour épuisé",
    passer_premium: "Passer en illimité",
    disclaimer: "MathScan t'aide à comprendre, pas à copier — regarde les étapes avant de rendre ton devoir.",
    compris: "J'ai compris",
    capture: "Capture",
    prendre_photo: "Prendre la photo",
    recadrer: "Recadrer la zone",
    valider: "Valider",
    reprendre: "Reprendre la photo",
    photo_floue: "Photo trop floue — reprends-la pour un résultat fiable.",
    traitement: "Traitement",
    lecture: "Lecture du texte",
    classification: "Identification de l'exercice",
    resolution: "Résolution",
    texte_detecte: "Texte détecté (corrige si besoin)",
    resoudre: "Résoudre",
    resultat: "Résultat",
    enonce: "Énoncé",
    reponse: "Réponse",
    explique: "Explique-moi",
    rapide: "Réponse rapide",
    etapes: "Étapes",
    partager: "Partager",
    defi: "Défie un ami",
    vide_historique: "Aucun exercice pour l'instant.",
    supprimer: "Supprimer",
    code_activation: "Code d'activation",
    activer: "Activer",
    code_invalide: "Code invalide — vérifie la saisie.",
    premium_actif: "Premium actif. Scans illimités.",
    acheter: "Acheter l'accès illimité",
    retour: "Retour",
    reessayer: "Réessayer",
    hors_ligne: "Tu es hors ligne",
    hors_ligne_txt: "Cette page n'est pas encore en cache, mais le scan et l'historique fonctionnent.",
  },
  en: {
    titre: "MathScan",
    accroche: "Scan your exercise, understand the solution.",
    hors_ligne_ok: "Works without internet",
    scanner: "Scan an exercise",
    importer: "Import an image",
    historique: "History",
    favoris: "Favorites",
    premium: "Premium",
    scans_restants: "scans left today",
    illimite: "Unlimited scans",
    quota_epuise: "Daily quota reached",
    passer_premium: "Go unlimited",
    disclaimer: "MathScan helps you understand, not copy — read the steps before handing in your homework.",
    compris: "Got it",
    capture: "Capture",
    prendre_photo: "Take photo",
    recadrer: "Crop the area",
    valider: "Confirm",
    reprendre: "Retake photo",
    photo_floue: "Photo too blurry — retake it for a reliable result.",
    traitement: "Processing",
    lecture: "Reading text",
    classification: "Identifying exercise",
    resolution: "Solving",
    texte_detecte: "Detected text (edit if needed)",
    resoudre: "Solve",
    resultat: "Result",
    enonce: "Problem",
    reponse: "Answer",
    explique: "Explain it",
    rapide: "Quick answer",
    etapes: "Steps",
    partager: "Share",
    defi: "Challenge a friend",
    vide_historique: "No exercises yet.",
    supprimer: "Delete",
    code_activation: "Activation code",
    activer: "Activate",
    code_invalide: "Invalid code — check your input.",
    premium_actif: "Premium active. Unlimited scans.",
    acheter: "Buy unlimited access",
    retour: "Back",
    reessayer: "Try again",
    hors_ligne: "You are offline",
    hors_ligne_txt: "This page isn't cached yet, but scanning and history still work.",
  },
} as const;

export type Clé = keyof (typeof DICO)["fr"];

export function useLangue() {
  const [langue, setLangue] = useState<Langue>("fr");
  useEffect(() => {
    const l = localStorage.getItem("mathscan:langue") as Langue | null;
    if (l === "fr" || l === "en") setLangue(l);
  }, []);
  const change = useCallback((l: Langue) => {
    localStorage.setItem("mathscan:langue", l);
    setLangue(l);
  }, []);
  const t = useCallback((clé: Clé) => DICO[langue][clé] ?? DICO.fr[clé], [langue]);
  return { langue, change, t };
}
