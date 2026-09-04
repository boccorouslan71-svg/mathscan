"use client";
/** Page de repli affichée si une navigation n'est pas encore en cache. */
import Link from "next/link";

export default function HorsLigne() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">✈︎</p>
      <h1 className="mt-4 text-2xl font-extrabold">Tu es hors ligne</h1>
      <p className="mt-2 text-sm text-ink-400">
        Cette page n&apos;est pas encore en cache, mais le scan, la résolution et l&apos;historique
        fonctionnent normalement.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Revenir à l&apos;accueil
      </Link>
    </main>
  );
}
