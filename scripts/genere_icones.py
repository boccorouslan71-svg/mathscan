"""Génère les icônes PWA de MathScan (192, 512, maskable 512) sans dépendance externe.

Rendu : dégradé violet -> encre, symbole « √x » centré, coins arrondis pour l'icône
« any » et marge de sécurité de 20% pour l'icône « maskable » (exigence Android).
Lancer :  python3 scripts/genere_icones.py
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "public" / "icons"
SORTIE.mkdir(parents=True, exist_ok=True)

VIOLET = (124, 58, 237)
ENCRE = (11, 11, 19)
CYAN = (34, 211, 238)


def police(taille: int) -> ImageFont.FreeTypeFont:
    for chemin in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(chemin).exists():
            return ImageFont.truetype(chemin, taille)
    return ImageFont.load_default(taille)


def degrade(taille: int) -> Image.Image:
    img = Image.new("RGB", (taille, taille))
    d = ImageDraw.Draw(img)
    for y in range(taille):
        k = y / max(1, taille - 1)
        d.line(
            [(0, y), (taille, y)],
            fill=tuple(int(VIOLET[i] + (ENCRE[i] - VIOLET[i]) * k) for i in range(3)),
        )
    return img


def dessine(taille: int, maskable: bool = False) -> Image.Image:
    img = degrade(taille).convert("RGBA")
    d = ImageDraw.Draw(img)
    marge = int(taille * 0.22) if maskable else int(taille * 0.1)
    # Cadre de « scan » : quatre coins, la métaphore de la capture
    long_, ep = int(taille * 0.14), max(2, int(taille * 0.028))
    for cx, cy, dx, dy in (
        (marge, marge, 1, 1),
        (taille - marge, marge, -1, 1),
        (marge, taille - marge, 1, -1),
        (taille - marge, taille - marge, -1, -1),
    ):
        d.line([(cx, cy), (cx + dx * long_, cy)], fill=CYAN, width=ep)
        d.line([(cx, cy), (cx, cy + dy * long_)], fill=CYAN, width=ep)

    txt = "√x"
    f = police(int(taille * (0.34 if maskable else 0.42)))
    bbox = d.textbbox((0, 0), txt, font=f)
    d.text(
        ((taille - bbox[2] + bbox[0]) / 2, (taille - bbox[3] + bbox[1]) / 2 - taille * 0.03),
        txt,
        font=f,
        fill=(255, 255, 255),
    )

    if not maskable:  # coins arrondis pour l'icône classique
        masque = Image.new("L", (taille, taille), 0)
        ImageDraw.Draw(masque).rounded_rectangle(
            [0, 0, taille - 1, taille - 1], radius=int(taille * 0.22), fill=255
        )
        img.putalpha(masque)
    return img


for taille in (192, 512):
    dessine(taille).save(SORTIE / f"icon-{taille}.png")
    print(f"icon-{taille}.png")
dessine(512, maskable=True).save(SORTIE / "icon-maskable-512.png")
print("icon-maskable-512.png")
# Écran de démarrage iOS (Apple ne lit pas le manifest pour ça)
dessine(1024).resize((1024, 1024)).save(SORTIE / "apple-touch-icon.png")
print("apple-touch-icon.png")
