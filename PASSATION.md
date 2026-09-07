---
type: markdown
title: MathScan — Dossier de passation complet
---

# MathScan — Dossier de passation

**Pour : l'agent IA qui reprend le projet.**
**Date : 7 septembre 2026.** Rédigé par l'agent précédent, à la demande du propriétaire.

Ce document est autoportant. Tu ne dois rien demander au propriétaire pour démarrer, sauf les
trois décisions explicitement listées en section 10. Lis les sections 4 et 5 avant de toucher au
code : elles contiennent des pièges qui ont coûté des heures et que tu vas reproduire sinon.

---

## 1. Le produit et son argument de vente

**MathScan** : application mobile où un élève photographie un exercice de maths de son cahier et
obtient la réponse **avec les étapes détaillées, en français**.

Marché visé : Afrique de l'Ouest francophone (le propriétaire est au Bénin, fuseau
Africa/Porto-Novo). Prix : paiement unique, à vie.

**L'argument de vente central, et la contrainte qui gouverne toute décision technique :
ça fonctionne SANS INTERNET.** L'élève n'a pas de forfait data fiable. Le propriétaire l'a
formulé lui-même : c'est « ce qu'on essaye de vendre comme solution ». Donc :

- Aucun appel réseau au moment de résoudre un exercice.
- Aucune IA générative dans le calcul. Le moteur est **100 % symbolique et déterministe** —
  aucun risque de réponse hallucinée sur un résultat de maths, et aucun serveur à payer.
- Tout octet téléchargé au premier lancement est un coût direct pour l'élève. Voir section 5,
  c'est le sujet sur lequel le propriétaire a été le plus mécontent, à juste titre.

Ne propose pas d'appeler une API de LLM pour résoudre les exercices. Ça détruirait les trois
propriétés ci-dessus.

---

## 2. Où en est le projet, concrètement

| Élément | Valeur |
|---|---|
| **Dépôt GitHub (public)** | `https://github.com/boccorouslan71-svg/mathscan` |
| Branche | `main` — 50 fichiers |
| ID du dépôt (pour l'API Vercel) | `1357679119` |
| Compte GitHub propriétaire | `boccorouslan71-svg` (boccorouslan71@gmail.com) |
| **Production en ligne** | `https://mathscan-kappa.vercel.app` |
| Alias Vercel | `mathscan-boccorouslan71-svgs-projects.vercel.app`, `mathscan-git-main-boccorouslan71-svgs-projects.vercel.app` |
| ID projet Vercel | `prj_SnY0ViaIkAAt9k7CwWDYyhdHh4CA` |
| ID équipe Vercel | `team_Pr3YrS7Z9Y98HImGFfNDT3CH` (slug `boccorouslan71-svgs-projects`) |
| Plan Vercel | Hobby (gratuit) |
| Déploiement auto | Oui — tout push sur `main` déclenche un déploiement de production |
| Statut | **En ligne et fonctionnel.** Pas encore mis en vente. |

L'app est déployée, elle lit une photo de cahier et renvoie les bonnes réponses. Ce qui bloque la
mise en vente n'est pas la qualité du calcul, c'est le circuit de paiement (section 9).

---

## 3. Architecture technique

**100 % client. Aucun backend, aucune base de données serveur, aucune API tierce.** C'est un site
statique + un Service Worker. Cette absence de serveur est volontaire (voir section 1).

```
Next.js 15.5.25  (App Router, export statique — 10 pages)
React 19.0.0 · TypeScript 5.7.3 · Tailwind 3.4.17
@ducanh2912/next-pwa 10.2.9   → Service Worker / installabilité / mode hors-ligne
dexie 4.4.5                   → IndexedDB : historique, favoris, quota, statut premium
tesseract.js 5.1.1            → OCR embarqué, modèle français local
mathjs 14.9.0                 → calcul symbolique (dérivées, expressions)
Node 24.x côté build Vercel
```

**Versions épinglées à l'exact, aucun `^`.** Next a été monté puis figé à `15.5.25` après une
alerte de sécurité sur `15.2.0`. Ne dégrade pas Next sous cette version.

### Arborescence et rôle de chaque fichier

```
app/
  page.tsx           Accueil : bouton scanner / importer une image
  scan/page.tsx      Capture caméra, import, recadrage (crop)
  traitement/page.tsx OCR + écran de relecture du texte détecté (l'élève peut corriger)
  resultat/page.tsx   Réponse, étapes, « Explique-moi », partage, favori
  historique/page.tsx Historique local et favoris
  premium/page.tsx    Offre, prix, lien d'achat, saisie du code d'activation
  offline/page.tsx    Page de repli hors-ligne
  layout.tsx, globals.css

lib/
  ocr.ts             Pilotage Tesseract (worker, langue, chemins des assets)
  glyphes.ts         *** Détecteur pixel du signe ÷ — voir section 4, pièce maîtresse ***
  image.ts           Prétraitement image (redimensionnement, contraste, recadrage)
  db.ts              Dexie : historique, quota, premium, validation du code
  i18n.ts            Français / anglais de l'interface
  share.ts           Partage (Web Share API + rendu canvas)
  classify/index.ts  Classification : quel type d'exercice ? (déterministe, à base de règles)
  classify/needle.ts Adaptateur Needle 2 optionnel — DÉSACTIVÉ par défaut, voir section 8
  solvers/           Un fichier par famille + index.ts qui route + types.ts (libellés FR/EN)

public/
  tesseract/lang/fra.traineddata.gz    modèle français, 5,99 Mo — SEUL modèle embarqué
  tesseract/*.wasm, *.wasm.js          moteur OCR, toutes les variantes (voir section 4)
  tesseract/worker.min.js
  icons/, manifest.json, sw.js         PWA

scripts/
  telecharge-assets.mjs  prebuild : télécharge moteur + modèle de langue dans public/
  genere_icones.py       génère les icônes PWA
  test-solveurs.ts       suite de tests du moteur → `npm run test:solveurs`
```

### Familles d'exercices couvertes (`lib/solvers/types.ts`)

| Type interne | Libellé affiché |
|---|---|
| `arithmetique` | Priorités des opérations |
| `liste_exercices` | Série d'opérations |
| `equation_lineaire` | Équation du 1er degré |
| `equation_quadratique` | Équation du 2nd degré |
| `systeme_2x2` | Système de 2 équations |
| `fraction` | Fractions |
| `pourcentage` | Pourcentages |
| `geometrie` | Aire et périmètre |
| `derivee` | Dérivée |
| `conversion_unite` | Conversion d'unités |
| `inconnu` | Non reconnu |

**Suite de tests : 45 cas, tous verts.** Lance `npm run test:solveurs` avant chaque push.
Si tu ajoutes une famille, ajoute ses cas.

### Commandes

```bash
npm install            # 477 paquets
npm run dev
npm run build          # exécute prebuild (télécharge les assets OCR) puis build
npm run test:solveurs
```

---

## 4. Pièges OCR — lis ceci avant de toucher à la lecture d'image

Ces conclusions sont **mesurées, pas supposées**. Chacune a coûté un aller-retour raté.

### 4.1 Tesseract ne connaît PAS le glyphe `÷`. C'est définitif.

Le symptôme initial : `90 - 15 ÷ 3` était lu sans le `÷`, donnait 78 au lieu de 85.

Le premier diagnostic — « le prétraitement d'image écrase les petits symboles » — **était faux**.
Preuve : **6 variantes de prétraitement et 48 tests OCR sur des glyphes rendus proprement, à
haute résolution, n'ont jamais retourné `÷` une seule fois.** Les modèles `fra` et `eng` de
Tesseract 4 ne contiennent tout simplement pas ce caractère.

**Ne retente pas de le corriger par du prétraitement, un `tessedit_char_whitelist`, un
changement de PSM ou une montée en résolution. C'est fait, c'est mesuré, ça ne marche pas.**

**La solution en place** (`lib/glyphes.ts`) : détection **géométrique au pixel**. On récupère les
boîtes englobantes des symboles via Tesseract, puis on cherche la signature du `÷` en trois
bandes horizontales — point / barre / point. Validé **13/13** sur glyphes rendus et sur la vraie
photo du propriétaire. Si tu touches à ce fichier, revalide sur les images de test.

### 4.2 Le `×` est TOUJOURS lu comme la lettre `x`

Constant, jamais l'inverse. Une normalisation contextuelle prudente convertit `x` en
multiplication quand le contexte est numérique (`6 x 4`) et **pas** quand c'est une inconnue
d'équation (`2x + 5 = 13`). Ne casse pas cette distinction : les deux cas coexistent dans les
cahiers.

### 4.3 Le bruit d'OCR autour des pointillés de réponse

Sur une photo de cahier, les pointillés où l'élève écrit sa réponse sont lus comme des mots
parasites : `ween`, `eens`, `eee`, `...--`. Les étiquettes d'items (`a)`, `b)`) produisent aussi
des `)` orphelins.

La normalisation en place supprime : les étiquettes d'item de zéro à deux lettres, et les blancs
de réponse non numériques en fin de ligne. C'est ce qui a débloqué `18 + 6 × 4` (qui échouait sur
un résidu `cen`) et la lecture des listes `a)` à `f)`.

### 4.4 Un bug de parenthèses déjà corrigé — ne le réintroduis pas

La première implémentation gardait **un index de parenthèse fermante devenu obsolète** après
réduction de l'expression, et échouait sur 100 % des cas parenthésés. Le correctif : recalculer
l'index après chaque réduction. Si tu réécris l'évaluateur, teste
`48 ÷ (6 + 2) = 6` et `(32 - 12) × 3 = 60`.

### 4.5 Le classificateur retombait à tort sur « Système de 2 équations »

Une liste d'opérations `a)` à `f)` était classée « Système de 2 équations » avec 95 % de
confiance. Corrigé par l'ajout du type `liste_exercices` (`lib/solvers/liste.ts`), qui détecte
une série d'items étiquetés et les résout un par un. La classification de `fraction` a aussi été
protégée de l'ambiguïté avec la division.

### 4.6 Toutes les variantes du moteur WASM doivent être présentes

En production, l'OCR ne se chargeait pas : `tesseract-core-simd-lstm.wasm.js` manquait. Selon le
téléphone, Tesseract.js choisit une variante différente (SIMD / non-SIMD / LSTM). **Les huit
fichiers de `public/tesseract/` sont tous nécessaires.** N'en supprime aucun pour « alléger ».

---

## 5. Données mobiles et mode hors-ligne — le sujet le plus sensible

Le propriétaire a signalé un retéléchargement à chaque test (au moins 4 fois) et une chute
brutale de ses données mobiles. Diagnostic instrumenté en production, octet par octet.

### Coût avant correction : 21,5 Mo au premier scan

| Fichier | Poids |
|---|---|
| Modèle **anglais** | 10,42 Mo |
| Modèle français | 5,99 Mo |
| Moteur WASM | 3,76 Mo |
| L'app | ~1,2 Mo |

### Deux causes, corrigées toutes les deux

**Cause 1 — le modèle anglais, 10,42 Mo pour rien.** Presque la moitié de la facture, pour lire
un cahier français. Les chiffres et les symboles sont identiques dans les deux modèles.
**Retiré.** `lib/ocr.ts` crée désormais le worker avec `["fra"]` seul, et
`scripts/telecharge-assets.mjs` ne télécharge plus que le français.

> **Ne le rajoute pas « au cas où ».** Chaque modèle ici est payé en données mobiles par chaque
> élève, au premier lancement. Si un besoin d'anglais apparaît un jour, il se charge à la
> demande, pas d'office.

**Cause 2 — les règles de cache étaient silencieusement ignorées.** Le tableau `runtimeCaching`
de `next.config.mjs` n'était **pas appliqué** : le Service Worker déployé ne contenait que les
règles par défaut du plugin, qui ne couvrent ni le modèle de langue `.gz` ni le binaire WASM.
Vérifié en production : les caches présents étaient `static-js-assets`, `pages`, `start-url`… et
aucun `mathscan-tesseract`. Les assets OCR ne survivaient que par le cache IndexedDB interne de
Tesseract.js — un seul filet, pour une app vendue « sans internet ».

**Le correctif tient en une option :** `extendDefaultRuntimeCaching: true` dans
`next.config.mjs`. Sans elle, tes règles de cache sont décoratives.

**Contrôle de non-régression, à faire après chaque build :**

```bash
grep -c "mathscan-tesseract" public/sw.js   # doit renvoyer au moins 1
```

Si ça renvoie 0, l'app s'est remise à retélécharger. C'est le test le plus important du projet.

### Coût après correction — mesuré sur profil neuf

| | Avant | Après |
|---|---|---|
| Premier scan | 21,50 Mo | **11,09 Mo** (−48 %) |
| Ouverture suivante, réseau | — | **0,00 Mo** |

### Pourquoi ça retéléchargeait quand même chez le propriétaire

La deuxième ouverture coûte 0 Mo dans un navigateur normal. Donc si ça retélécharge, c'est que le
navigateur ne conserve rien entre deux visites — comportement typique des **navigateurs intégrés
aux messageries** (WhatsApp, Telegram, Facebook), qui utilisent un espace jetable vidé en
sortant. S'ajoutait à cela une part légitime : plusieurs redéploiements le même jour, chacun
invalidant une partie du cache.

**Consigne d'installation à redonner au propriétaire si besoin :** ouvrir le lien **dans Chrome**
(pas depuis une messagerie), puis menu **⋮ → « Installer l'application »**. Une app installée
obtient un stockage permanent : 11 Mo une fois, puis plus jamais.

---

## 6. Vérifications de production réussies — l'état de référence

À reproduire à l'identique après toute modification du pipeline OCR ou des solveurs.

**Photo de page entière, en production, sans aucune erreur JavaScript :**

Texte restitué par l'OCR, puis classé « Série d'opérations » à 93 % de confiance, puis résolu :

```
a) 72 ÷ 8 = 9              d) 90 − 15 ÷ 3 = 85     ← le cas ÷ historique
b) 120 + 45 − 38 = 127     e) (32 − 12) × 3 = 60
c) 18 + 6 × 4 = 42         f) 48 ÷ (6 + 2) = 6
```

**Six réponses, six justes**, avec les étapes (`15 ÷ 3 = 5` puis `90 − 5 = 85`) et la règle
pédagogique affichée (« × et ÷ avant + et − »).

Autres validations : clone propre + `npm install` (477 paquets) + build de 10 pages statiques +
Service Worker généré ; contrôles routes / manifeste / icônes / assets OCR ; 45/45 cas de
solveurs.

**Méthode de test utilisée :** pilotage d'un vrai Chromium sur l'URL de production, avec profil
neuf pour mesurer le premier chargement, comptage des requêtes réseau et de celles servies par le
Service Worker, et lecture des erreurs console. Refais-le sur `https://mathscan-kappa.vercel.app`
plutôt que sur un serveur local : les bugs de cache et d'assets ne se voient **qu'**en production.

---

## 7. Prix — décidé et implémenté, ne le rediscute pas

Validé par le propriétaire le 5 septembre 2026 :

- **2 000 FCFA** — paiement unique, accès à vie.
- **1 000 FCFA** — prix de lancement, réservé aux **100 premiers acheteurs**.
- Aucun abonnement. Affiché tel quel sur `app/premium/page.tsx`.

**Pour clore l'offre de lancement, aucun changement de code** : mettre la variable Vercel
`NEXT_PUBLIC_OFFRE_LANCEMENT=0`. Le comptage des 100 premiers n'est pas automatisé — c'est un
geste manuel quand le propriétaire aura vendu 100 licences.

---

## 8. Accès, comptes, variables et jetons

### Ce projet ne contient aucune clé d'API. Ce n'est pas un oubli.

Vérifié fichier par fichier : il n'y a **ni backend, ni base distante, ni service tiers appelé au
runtime**. Aucun fichier `.env` n'existe dans le dépôt. L'app tourne entièrement dans le
navigateur de l'élève. Il n'y a donc littéralement aucune clé secrète à te transmettre — la seule
variable sensible du produit est le sel des codes premium, documenté en 9.1.

### Variables d'environnement Vercel : aucune n'est configurée

Vérifié via l'API Vercel sur le projet : la liste est **vide**. L'application tourne donc sur ses
valeurs par défaut, codées en dur :

| Variable | État actuel | Défaut appliqué | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_CHARIOW_URL` | non définie | `https://chariow.com` | lien d'achat — **à définir, voir 9.2** |
| `NEXT_PUBLIC_CODE_SEL` | non définie | `mathscan-v1` | sel du checksum des codes premium |
| `NEXT_PUBLIC_OFFRE_LANCEMENT` | non définie | offre active | `0` pour clore le lancement |
| `NEXT_PUBLIC_NEEDLE_ENABLED` | non définie | désactivé | classificateur Needle 2 optionnel |

Ces quatre variables sont publiques par construction (préfixe `NEXT_PUBLIC_`) : elles partent dans
le bundle envoyé au navigateur. Ce sont des réglages, pas des secrets.

### Jetons GitHub et Vercel : masqués par la plateforme, fait technique

Le propriétaire a demandé que les jetons figurent ici. J'ai tenté de les extraire pour les deux
connecteurs. Réponse de l'infrastructure, mot pour mot :

```
{"success":false,"platform":"github","error":"Token is masked or unavailable."}
{"success":false,"platform":"vercel","error":"Token is masked or unavailable."}
```

Ce ne sont pas des clés que le propriétaire a créées et collées : ce sont des jetons OAuth émis à
la plateforme d'agents, masqués côté serveur et de durée limitée. Même transmis, ils seraient
expirés avant de te servir. **Comment tu obtiens l'accès à la place :**

- **Si tu tournes sur la même plateforme d'agents** : les connecteurs GitHub et Vercel sont déjà
  autorisés sur ce projet. Tu les utilises directement, sans jeton en clair.
- **Sinon** : demande au propriétaire de générer lui-même un *Personal Access Token* GitHub
  (portée `repo`) et un *Access Token* Vercel depuis les réglages de son compte. Ce sont deux
  formulaires, deux minutes. C'est la seule chose que tu auras à lui demander côté accès.
- **Repli sans aucun jeton** : le dépôt est **public**. `git clone` fonctionne sans
  authentification. Tu peux travailler, builder et tester immédiatement ; seuls le push et le
  redéploiement demandent l'autorisation.

### Chariow

Le compte Chariow appartient au propriétaire. **L'URL de vente n'a jamais été communiquée** —
c'est pour ça que le lien pointe encore sur `https://chariow.com`. C'est la deuxième chose à lui
demander (section 10).

### Limite connue de l'outil de push

Le connecteur GitHub refuse `package-lock.json` s'il dépasse sa limite de charge utile
individuelle. Le fichier est aujourd'hui présent dans le dépôt ; si un push le rejette, pousse-le
séparément ou par `git` en ligne de commande. Les versions exactes restent de toute façon
épinglées dans `package.json`.

---

## 9. Travaux en attente — spécifications précises

Par ordre de blocage commercial.

### 9.1 BLOQUANT — l'activation premium ne vérifie aucun paiement

**C'est le seul point qui empêche la mise en vente. Le propriétaire en est informé.**

État actuel, dans `lib/db.ts` :

```
Format du code : MS-XXXX-XXXX-K
K = clé de contrôle = ALPHABET[somme mod 36]
    où somme = Σ (charCode(SEL+corps)[i] × (i+7)),  ALPHABET = "0123456789…Z"
    et SEL = process.env.NEXT_PUBLIC_CODE_SEL ?? "mathscan-v1"
```

`codeValide()` valide **la forme du code, pas un achat**. Le calcul se fait entièrement dans le
navigateur, et le sel voyage dans le bundle client (préfixe `NEXT_PUBLIC_`). Conséquence
fonctionnelle : quiconque lit le code JavaScript de la page peut fabriquer des codes valides à
l'infini, et un code acheté peut être partagé sans limite. Ce n'est donc pas un circuit de vente,
c'est un portillon de démonstration.

Note utile pour tes tests : avec l'algorithme ci-dessus, tu peux générer autant de codes valides
que nécessaire sans passer par Chariow.

Le vrai arbitrage à porter au propriétaire, parce qu'il touche à l'argument de vente :

- **Option A — codes signés, générés côté vendeur, un usage.** Le vendeur (ou une fonction
  serverless Vercel appelée par le webhook Chariow) génère un code signé cryptographiquement,
  unique, lié à l'achat. L'app le vérifie hors-ligne avec une **clé publique** embarquée : la
  signature ne peut pas être forgée, même en lisant le code source. **Conserve le
  fonctionnement hors-ligne intégral.** C'est la voie recommandée.
- **Option B — validation en ligne une seule fois, à l'activation.** L'app contacte un point
  d'entrée au moment de l'activation, puis plus jamais. Simple, mais exige une connexion le jour
  de l'achat — acceptable, puisque l'élève vient de payer en ligne.
- **Option C — statu quo assumé.** Le propriétaire vend en sachant que les codes fuiteront.

Option A demande une fonction serverless (Vercel Hobby en offre gratuitement) et le webhook
Chariow. Elle ne remet pas en cause le « sans internet » : la vérification reste locale.

### 9.2 BLOQUANT — brancher Chariow

Chariow est une plateforme de vente distincte : elle encaisse, mais n'a par défaut aucun moyen de
prévenir MathScan. Deux choses à obtenir du propriétaire :

1. **L'URL de sa page produit Chariow** → à mettre dans `NEXT_PUBLIC_CHARIOW_URL` sur Vercel.
2. **Savoir si son offre Chariow expose un webhook ou une livraison de contenu après paiement.**
   C'est ce qui décide entre A et B ci-dessus. Le circuit visé :
   `achat Chariow → webhook → génération d'un code signé → livraison à l'acheteur → saisie dans
   l'app → activation hors-ligne définitive`.

### 9.3 IMPORTANT — l'OCR pleine page ne lit qu'une partie des exercices

Sur la photo de page entière, l'OCR a restitué **6 exercices sur une dizaine présents**. Les
réponses données sont justes, mais :

- la liste est **incomplète** ;
- les lettres (`a)`, `b)`…) sont attribuées **dans l'ordre de lecture**, donc elles peuvent
  décaler par rapport au cahier de l'élève.

Contournement actuel : cadrer sur une moitié de page donne un résultat complet. Piste à
instruire : segmentation en blocs avant l'OCR (découper la page par lignes/colonnes détectées et
lancer l'OCR par bloc), et conservation des étiquettes réellement lues plutôt qu'une
renumérotation. À traiter avant la mise en vente : un élève qui reçoit 6 réponses sur 10, mal
étiquetées, se sent trompé.

### 9.4 SOUHAITÉ par le propriétaire — une vraie APK Android

Son raisonnement, et il est juste : tant qu'il reste un premier téléchargement de 11 Mo, le
« sans internet » garde un astérisque — et un astérisque dans un argument de vente se paie en
demandes de remboursement.

**Solution identifiée : Capacitor.** On emballe l'app **et le modèle OCR** dans l'APK. Résultat :
**zéro téléchargement, jamais.** L'élève installe l'APK (~18 Mo, une fois) et l'app marche dès la
première seconde en mode avion. Plus de cache à perdre, plus de navigateur à discuter. Bénéfice
commercial spécifique à ce marché : une APK se partage par Bluetooth ou WhatsApp entre élèves.

**Ce qui bloque, vérifié :** l'environnement d'exécution de l'agent précédent n'a **ni Java ni le
SDK Android**, donc la compilation y est impossible. Il faut soit un ordinateur avec Android
Studio, soit un service de compilation en ligne (une action GitHub Actions sur ce dépôt fait très
bien l'affaire, et c'est gratuit sur un dépôt public — piste à privilégier, elle ne demande rien
au propriétaire).

Marche à suivre : `npm i @capacitor/core @capacitor/cli @capacitor/android`, configurer Next en
export statique vers `out/`, `npx cap add android`, vérifier que `public/tesseract/` est bien
embarqué dans les assets, puis compiler. **Vérifie le mode avion sur un vrai téléphone avant
d'annoncer que c'est fait** — c'est toute la promesse du produit.

### 9.5 Optionnel — Needle 2

Un adaptateur de classification Needle 2 existe (`lib/classify/needle.ts`) mais il est
**désactivé** et n'est pas une dépendance de fonctionnement. Aucun build navigateur officiel
supporté n'a été établi ; ça dépend d'une compilation communautaire. Le classificateur
déterministe suffit. À laisser tel quel sauf demande explicite.

---

## 10. Ce que tu dois faire en arrivant

1. Cloner le dépôt public, `npm install`, `npm run build`, `npm run test:solveurs` (45/45 attendus),
   puis `grep -c "mathscan-tesseract" public/sw.js` (≥ 1 attendu). Tu as alors un socle sain.
2. Tester l'app en production sur `https://mathscan-kappa.vercel.app` avec une vraie photo de
   cahier, profil de navigateur neuf, pour constater par toi-même l'état de référence de la
   section 6.
3. **Poser au propriétaire ces trois questions, et seulement celles-là :**
   - l'URL de sa page produit Chariow, et si son offre expose un webhook après paiement ;
   - son arbitrage entre les options A / B / C de la section 9.1 ;
   - s'il veut l'APK Capacitor avant la mise en vente ou après (recommandation : la compiler via
     une action GitHub sur le dépôt, ça ne lui demande rien).
4. Puis, dans cet ordre : sécuriser l'activation premium (9.1 + 9.2), corriger l'OCR pleine page
   (9.3), livrer l'APK (9.4).

**Deux règles de conduite sur ce projet.** D'abord : ne conclus jamais qu'une correction marche
sans l'avoir vérifiée **en production, sur une vraie photo**. Chaque erreur de ce projet — le
`÷` introuvable, l'OCR qui ne chargeait pas, les règles de cache ignorées — a été trouvée en
mesurant, et aucune n'était visible en local. Ensuite : le propriétaire teste sur son propre
forfait mobile. Regroupe tes redéploiements au lieu de le faire retélécharger à chaque essai.
