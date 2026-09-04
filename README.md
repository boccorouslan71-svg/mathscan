# MathScan

**Scanne un exercice de maths → solution étape par étape, sans connexion internet.**

PWA Next.js (App Router, TypeScript, Tailwind), installable sur l'écran d'accueil,
entièrement fonctionnelle en mode avion après le premier chargement.

---

## Ce qui tourne, et où

| Brique | Techno | Exécution |
|---|---|---|
| Interface | Next.js 15 (App Router) + Tailwind | Navigateur |
| OCR | Tesseract.js 5 (WASM, modèles `fra` + `eng`) | Navigateur, offline |
| Classification / extraction | Règles déterministes (`lib/classify`) — Needle 2 en renfort optionnel | Navigateur, offline |
| Résolution | Moteur symbolique maison en rationnels exacts + math.js pour le parsing | Navigateur, offline |
| Stockage | IndexedDB via Dexie (historique, favoris, quota, premium) | Appareil |
| Offline | Service Worker Workbox via `@ducanh2912/next-pwa` | Navigateur |
| Paiement | Chariow (lien externe) + code d'activation vérifié en local | — |

**Aucun backend.** Aucune donnée d'élève ne quitte le téléphone.

---

## Types d'exercices couverts (V1)

Équations du 1er degré · équations du 2nd degré (discriminant) · systèmes 2×2 ·
fractions (+ − × ÷, simplification) · pourcentages (5 formes : « p% de N », hausse/remise,
proportion, variation entre deux prix, valeur initiale) · aires et périmètres (carré,
rectangle, triangle, cercle) · dérivées de polynômes · conversions d'unités (longueur,
masse, capacité, aire, volume, temps, vitesse).

Chaque résolution renvoie un tableau d'étapes structurées :
`{ étape, opération, explication, résultat_intermédiaire }`.

### Tests du moteur

```bash
npm run test:solveurs     # 25 cas, réponses exactes attendues
```

Le moteur est **déterministe** : aucun LLM n'intervient dans un calcul, donc aucun
risque d'hallucination sur un résultat. Toute régression est attrapée par ces tests.

---

## Développement local

```bash
npm install
npm run icones            # (optionnel) régénère les icônes PWA — nécessite Python + Pillow
node scripts/telecharge-assets.mjs   # binaires OCR locaux (~25 Mo, non versionnés)
npm run dev               # http://localhost:3000
```

Le Service Worker n'est actif qu'en build de production :

```bash
npm run build && npm start
```

### Tester le mode hors-ligne

1. `npm run build && npm start`, ouvrir le site, faire **un** scan complet (le modèle de langue se télécharge et se met en cache à ce moment).
2. Chrome DevTools → *Application* → *Service Workers* : cocher **Offline** (ou activer le mode avion sur le téléphone).
3. Recharger : l'accueil, le scan, la résolution et l'historique doivent fonctionner. Une route jamais visitée affiche la page `/offline`.

---

## Déploiement sur Vercel — depuis un téléphone, sans PC

1. **Créer le dépôt.** Sur github.com (version mobile ou app GitHub) : *New repository* → nom `mathscan` → privé ou public.
2. **Y envoyer le code.** Décompresse l'archive du projet, puis soit *Add file → Upload files* (glisser tout le contenu **sauf** `node_modules`), soit depuis l'app *Working Copy* (iOS) / *Termux* (Android) si tu préfères un vrai `git push`.
3. **Importer sur Vercel.** vercel.com → *Add New… → Project* → *Import Git Repository* → choisir `mathscan`. Framework détecté automatiquement : **Next.js**. Aucun réglage de build à changer.
4. **Variables d'environnement** (onglet *Settings → Environment Variables*), toutes optionnelles :

| Variable | Rôle | Défaut |
|---|---|---|
| `NEXT_PUBLIC_CHARIOW_URL` | Lien de ta page de vente Chariow | `https://chariow.com` |
| `NEXT_PUBLIC_CODE_SEL` | Sel de génération des codes d'activation | `mathscan-v1` |
| `NEXT_PUBLIC_NEEDLE_ENABLED` | `1` pour activer Needle 2 (voir plus bas) | désactivé |

5. **Deploy.** Le script `prebuild` télécharge les binaires OCR pendant le build : rien à committer.
6. **Installer l'app.** Ouvrir l'URL Vercel sur le téléphone → menu du navigateur → *Ajouter à l'écran d'accueil*. L'icône apparaît, l'app s'ouvre en plein écran.

> Domaine personnalisé : *Settings → Domains*. Un HTTPS valide est obligatoire pour la caméra et le Service Worker — Vercel le fournit.

---

## Codes d'activation premium

La vérification est **locale** : pas de serveur à maintenir, et le premium survit au mode avion.

Format : `MS-XXXX-XXXX-K`, où `K` est une clé de contrôle dérivée du corps du code et du sel
`NEXT_PUBLIC_CODE_SEL`.

Générer un lot de codes à vendre sur Chariow :

```bash
node -e "
const SEL=process.env.NEXT_PUBLIC_CODE_SEL||'mathscan-v1',A='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const k=c=>{let s=0;const x=(SEL+c).toUpperCase();for(let i=0;i<x.length;i++)s+=x.charCodeAt(i)*(i+7);return A[s%36]};
const r=n=>Array.from({length:n},()=>A[Math.floor(Math.random()*36)]).join('');
for(let i=0;i<20;i++){const a=r(4),b=r(4);console.log('MS-'+a+'-'+b+'-'+k(a+b));}"
```

⚠️ Un code non lié à un compte est partageable entre élèves. C'est un choix assumé (zéro
backend, zéro friction, zéro coût). Si la fuite devient un problème, l'étape suivante est
une liste de codes déjà utilisés vérifiée **au moment de l'activation seulement** (une
connexion suffit une fois) — le reste de l'app resterait offline.

---

## Needle 2 (optionnel, désactivé par défaut)

Cactus publie Needle 2 avec une démo WebAssembly, mais il n'existe pas de SDK npm
officiel supporté pour le navigateur ; les builds WASM disponibles sont communautaires.
Faire dépendre la classification — donc tout le parcours utilisateur — d'un binaire de
14 Mo non officiel, alors que des règles déterministes classent mieux un texte OCR déjà
structuré, serait un risque produit inutile.

L'adaptateur est donc prêt mais inactif (`lib/classify/needle.ts`). Pour l'activer :

1. déposer `needle.js`, `needle.wasm`, `needle-2.bin` dans `public/needle/` ;
2. mettre `NEXT_PUBLIC_NEEDLE_ENABLED=1` sur Vercel.

Il vient alors **en renfort** des règles (jamais en remplacement) : utile surtout sur les
problèmes rédigés en langage naturel. En cas d'absence ou d'échec, l'app retombe
silencieusement sur les règles — aucune erreur visible pour l'élève.

---

## Structure

```
app/               écrans : accueil, scan, traitement, resultat, historique, premium, offline
components/        composants partagés (en-tête, thème, langue)
lib/
  classify/        classifieur par règles + adaptateur Needle 2 optionnel
  solvers/         moteur : rationnels exacts, polynômes, 8 familles d'exercices
  db.ts            IndexedDB (historique, favoris, quota 3/jour, premium)
  ocr.ts           Tesseract.js (worker, modèles locaux)
  image.ts         netteté (variance du Laplacien), recadrage, binarisation Otsu
  share.ts         image de partage watermarkée + « Défie un ami »
  i18n.ts          FR / EN
scripts/           tests du moteur, téléchargement des assets OCR, génération d'icônes
```

---

## Roadmap

- **V2** — physique-chimie, trigonométrie, statistiques, systèmes 3×3, quotients de dérivées.
- **V3** — mini-LLM embarqué (Gemma / Phi quantisé) pour les problèmes rédigés ouverts,
  à évaluer selon l'adoption V1 (le poids du modèle est le vrai arbitrage).

## Note produit

Le disclaimer « MathScan t'aide à comprendre, pas à copier » s'affiche à l'onboarding et
reste visible sur l'accueil. Les étapes sont toujours calculées, même en mode « Réponse
rapide » (elles ne sont que repliées) : c'est ce qui protège l'app sur les stores et
rassure les parents.
