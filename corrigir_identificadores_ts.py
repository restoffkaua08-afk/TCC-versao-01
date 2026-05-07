from pathlib import Path
import re

root = Path.cwd()
src = root / "frontend" / "src"

replacements = {
    "Estado OperacionalBadge": "StatusBadge",
    "EstadoOperacionalBadge": "StatusBadge",
    "Estado OperacionalText": "StatusText",
    "EstadoOperacionalText": "StatusText",
}

changed = 0

for path in src.rglob("*"):
    if path.suffix.lower() not in [".ts", ".tsx", ".js", ".jsx"]:
        continue

    text = path.read_text(encoding="utf-8")
    original = text

    for old, new in replacements.items():
        text = text.replace(old, new)

    # Corrige import quebrado especificamente, caso tenha ficado com espaço
    text = text.replace(
        "fmt, Kpi, PageHeader, StatusBadge, statusText",
        "fmt, Kpi, PageHeader, StatusBadge, statusText"
    )

    # Proteção extra: se alguma função export foi quebrada com espaço no nome
    text = re.sub(
        r"export function Estado\s+OperacionalBadge",
        "export function StatusBadge",
        text
    )

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"OK: {path.relative_to(root)}")
        changed += 1

print(f"Arquivos corrigidos: {changed}")
