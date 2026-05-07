from pathlib import Path
import re

root = Path.cwd()
src = root / "frontend" / "src"
public = root / "frontend" / "public"

# ============================================================
# 1) Corrigir qualquer resíduo perigoso que tenha sobrado
# ============================================================

danger_replacements = {
    "Estado OperacionalBadge": "StatusBadge",
    "EstadoOperacionalBadge": "StatusBadge",
    "Estado OperacionalText": "statusText",
    "EstadoOperacionalText": "statusText",
}

for path in src.rglob("*"):
    if path.suffix.lower() not in [".ts", ".tsx", ".js", ".jsx"]:
        continue

    text = path.read_text(encoding="utf-8")
    original = text

    for old, new in danger_replacements.items():
        text = text.replace(old, new)

    # Corrige imports quebrados por substituição textual anterior
    text = text.replace("Estado OperacionalBadge", "StatusBadge")
    text = re.sub(r"export function Estado\s+OperacionalBadge", "export function StatusBadge", text)

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"OK: resíduo corrigido em {path.relative_to(root)}")

# ============================================================
# 2) CSS menos artificial, sem mexer em lógica
# ============================================================

human_css = src / "humanized-ui.css"
human_css.write_text(r'''
/* TSEA - UI industrial sóbria
   Ajusta apenas aparência. Não altera lógica nem endpoints. */

:root {
  --tsea-bg: #f4f5f2;
  --tsea-surface: #ffffff;
  --tsea-soft: #f8f9f7;
  --tsea-line: #d9ded9;
  --tsea-line-strong: #c3cbc5;
  --tsea-ink: #1d2824;
  --tsea-muted: #637069;
  --tsea-green: #28584a;
  --tsea-green-dark: #183d34;
  --tsea-red: #9b3f35;
  --tsea-amber: #9a6a1f;
  --tsea-blue: #285a88;
}

html,
body {
  background: var(--tsea-bg) !important;
  color: var(--tsea-ink) !important;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
}

body {
  background-image: none !important;
}

body::before,
body::after {
  display: none !important;
}

.topbar,
.top,
header,
.app-header {
  background: #ffffff !important;
  border-bottom: 1px solid var(--tsea-line) !important;
  box-shadow: none !important;
}

.panel,
.card,
.kpi,
.page-header,
.hero,
.regulator-card,
.regulator,
.drawer,
.modal,
.chart-card,
.table-card {
  border: 1px solid var(--tsea-line) !important;
  border-radius: 10px !important;
  box-shadow: none !important;
  background: var(--tsea-surface) !important;
}

.kpi {
  border-left: 4px solid var(--tsea-line-strong) !important;
  border-top: 1px solid var(--tsea-line) !important;
}

.kpi.good { border-left-color: var(--tsea-green) !important; }
.kpi.warn { border-left-color: var(--tsea-amber) !important; }
.kpi.bad { border-left-color: var(--tsea-red) !important; }

h1,
h2,
h3,
.kpi strong {
  letter-spacing: -0.025em !important;
  color: var(--tsea-ink) !important;
}

h1 {
  font-size: clamp(1.65rem, 2.4vw, 2.35rem) !important;
}

h2 {
  font-size: clamp(1.2rem, 1.7vw, 1.55rem) !important;
}

p,
small,
span,
label {
  color: var(--tsea-muted);
}

.eyebrow {
  color: var(--tsea-green) !important;
  letter-spacing: .08em !important;
  font-weight: 800 !important;
}

button,
.button,
a.button {
  border-radius: 7px !important;
  box-shadow: none !important;
  background: var(--tsea-green) !important;
  color: #fff !important;
  font-weight: 750 !important;
  letter-spacing: 0 !important;
}

button:hover,
.button:hover,
a.button:hover {
  background: var(--tsea-green-dark) !important;
  filter: none !important;
}

button.secondary,
button.ghost,
a.secondary,
.ghost {
  background: #fff !important;
  color: var(--tsea-ink) !important;
  border: 1px solid var(--tsea-line-strong) !important;
}

button.danger,
.danger {
  background: var(--tsea-red) !important;
}

.badge,
.pill {
  border-radius: 5px !important;
  padding: 4px 8px !important;
  font-weight: 760 !important;
  box-shadow: none !important;
}

.badge.good,
.pill.ok,
.ok {
  background: #e8eee9 !important;
  color: #214f40 !important;
}

.badge.warn,
.pill.warn,
.warn {
  background: #f4ead8 !important;
  color: #765319 !important;
}

.badge.bad,
.pill.bad,
.bad {
  background: #f3e2df !important;
  color: #86372f !important;
}

table {
  border-collapse: collapse !important;
  background: #fff !important;
}

th {
  background: #f1f3f1 !important;
  color: #4d5a54 !important;
  font-size: .76rem !important;
  letter-spacing: .035em !important;
  border-bottom: 1px solid var(--tsea-line-strong) !important;
}

td {
  border-bottom: 1px solid #e8ece8 !important;
}

tr:hover td {
  background: #f8faf8 !important;
}

input,
select,
textarea {
  border-radius: 7px !important;
  border: 1px solid var(--tsea-line-strong) !important;
  background: #fff !important;
  color: var(--tsea-ink) !important;
  box-shadow: none !important;
}

input:focus,
select:focus,
textarea:focus {
  outline: 2px solid rgba(40, 88, 74, .18) !important;
  border-color: var(--tsea-green) !important;
}

.chart,
.chart-card {
  background: #fbfcfb !important;
  border: 1px solid var(--tsea-line) !important;
  border-radius: 8px !important;
}

.regulator-svg,
.tank {
  filter: none !important;
}

.regulator-card,
.regulator {
  border-top: 1px solid var(--tsea-line) !important;
  border-left: 4px solid var(--tsea-green) !important;
}

.regulator-card.warn,
.regulator.warn {
  border-left-color: var(--tsea-amber) !important;
}

.regulator-card.bad,
.regulator.bad {
  border-left-color: var(--tsea-red) !important;
}

.tsea-records-shortcut {
  right: 22px !important;
  bottom: 18px !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  color: var(--tsea-green-dark) !important;
  border: 1px solid var(--tsea-line-strong) !important;
  box-shadow: 0 6px 18px rgba(16, 30, 24, .10) !important;
  padding: 10px 13px !important;
  font-size: .9rem !important;
}

.legend span {
  border-radius: 5px !important;
  background: #fff !important;
}

@media (max-width: 900px) {
  .tsea-records-shortcut {
    position: static !important;
    display: inline-flex !important;
    margin: 12px !important;
  }
}
''', encoding="utf-8")

# Importar CSS sem mexer no resto
entry_candidates = [
    src / "main.tsx",
    src / "main.jsx",
    src / "main.ts",
    src / "main.js",
]

for entry in entry_candidates:
    if entry.exists():
        text = entry.read_text(encoding="utf-8")
        if 'humanized-ui.css' not in text:
            lines = text.splitlines()
            insert_at = 0
            for i, line in enumerate(lines):
                if line.startswith("import "):
                    insert_at = i + 1
            lines.insert(insert_at, 'import "./humanized-ui.css";')
            entry.write_text("\n".join(lines) + "\n", encoding="utf-8")
            print(f"OK: humanized-ui.css importado em {entry.name}")
        break

# ============================================================
# 3) Limpeza textual segura SOMENTE na página standalone
#    Não altera TSX, funções, imports ou nomes internos.
# ============================================================

records = public / "registros.html"
if records.exists():
    html = records.read_text(encoding="utf-8")

    safe_text_replacements = {
        "Operações reais e simulações agora ficam separadas": "Histórico técnico de ciclos e simulações",
        "Esta tela organiza o histórico de forma auditável: filtros por período, tanque, operador, status, mangueira e tipo de tanque. Também permite re-simular, gerar relatório e exportar CSV.": "Consulta estruturada de ciclos operacionais, simulações, parâmetros, resultados, relatórios e dados exportáveis.",
        "Use filtros diferentes para operação real e simulação. O objetivo é facilitar auditoria e reuso técnico.": "Use os filtros para localizar ciclos, simulações e parâmetros técnicos com precisão.",
        "Registros e Histórico": "Histórico Operacional",
        "Operações reais": "Ciclos Operacionais",
        "Simulações": "Simulações de Processo",
        "Ver": "Detalhes",
        "Simular novamente": "Reexecutar simulação",
        "Re-simular": "Reexecutar",
        "Converter para operação real": "Enviar para execução",
        "Gerar relatório": "Relatório técnico",
        "Exportar CSV": "Exportar CSV",
        "API verificando": "API verificando",
        "Voltar ao sistema": "Painel principal",
    }

    for old, new in safe_text_replacements.items():
        html = html.replace(old, new)

    if "Ajuste visual operacional TSEA" not in html:
        html = html.replace("</head>", r'''
  <style>
    /* Ajuste visual operacional TSEA */
    :root {
      --bg: #f4f5f2 !important;
      --card: #ffffff !important;
      --ink: #1d2824 !important;
      --muted: #637069 !important;
      --line: #d9ded9 !important;
      --green: #28584a !important;
      --red: #9b3f35 !important;
      --amber: #9a6a1f !important;
      --shadow: none !important;
    }

    body { background: #f4f5f2 !important; }

    .hero,
    .panel,
    .drawer {
      border-radius: 10px !important;
      box-shadow: none !important;
      border: 1px solid #d9ded9 !important;
    }

    button,
    a.button {
      border-radius: 7px !important;
      box-shadow: none !important;
      font-weight: 750 !important;
    }

    .pill {
      border-radius: 5px !important;
      font-weight: 760 !important;
    }

    th { background: #f1f3f1 !important; }
    tr:hover td { background: #f8faf8 !important; }
    .chart { border-radius: 8px !important; }
  </style>
</head>''')

    records.write_text(html, encoding="utf-8")
    print("OK: textos visíveis de registros ajustados com segurança.")

print("Correção controlada do frontend concluída.")
