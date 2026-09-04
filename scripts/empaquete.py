"""Empaquette le projet MathScan en une archive .zip prête à envoyer sur GitHub.

Exclut node_modules, .next, le Service Worker généré et les binaires OCR téléchargés
au build (~25 Mo) : tout cela se reconstruit avec `npm install` puis `npm run build`.
Usage : python3 scripts/empaquete.py <dossier_projet> <archive_sortie>
"""

import sys
import zipfile
from pathlib import Path

EXCLUS_DOSSIERS = {"node_modules", ".next", "out", ".git", "__pycache__"}
EXCLUS_CHEMINS = {
    "public/sw.js",
    "public/sw.js.map",
    "public/tesseract/worker.min.js",
    "public/tesseract/tesseract-core.wasm.js",
    "public/tesseract/tesseract-core-simd.wasm.js",
}
EXCLUS_PREFIXES = ("public/tesseract/lang/", "public/workbox-", "public/fallback-")
EXCLUS_SUFFIXES = (".tsbuildinfo",)

projet = Path(sys.argv[1]).resolve()
sortie = Path(sys.argv[2]).resolve()
sortie.parent.mkdir(parents=True, exist_ok=True)

retenus, ignorés = 0, 0
with zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for chemin in sorted(projet.rglob("*")):
        if not chemin.is_file():
            continue
        rel = chemin.relative_to(projet)
        rel_txt = rel.as_posix()
        if (
            EXCLUS_DOSSIERS & set(rel.parts)
            or rel_txt in EXCLUS_CHEMINS
            or rel_txt.startswith(EXCLUS_PREFIXES)
            or rel_txt.endswith(EXCLUS_SUFFIXES)
        ):
            ignorés += 1
            continue
        z.write(chemin, Path("mathscan") / rel)
        retenus += 1

print(f"{retenus} fichiers empaquetés, {ignorés} ignorés")
print(f"{sortie} — {sortie.stat().st_size / 1024:.0f} Ko")
