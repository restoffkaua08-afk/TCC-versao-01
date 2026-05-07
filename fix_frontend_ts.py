from pathlib import Path
import re

root = Path.cwd()

# 1) Corrigir .at(-1), que quebra no TypeScript atual
regulator = root / "frontend" / "src" / "components" / "RegulatorVisual.tsx"
if regulator.exists():
    text = regulator.read_text(encoding="utf-8")
    text = text.replace("result.timeline.at(-1)", "result.timeline[result.timeline.length - 1]")
    text = text.replace("timeline.at(-1)", "timeline[timeline.length - 1]")
    regulator.write_text(text, encoding="utf-8")
    print("OK: RegulatorVisual.tsx")

# 2) Remover tanks={tanks} do TwinComparison
digital = root / "frontend" / "src" / "pages" / "DigitalTwinPage.tsx"
if digital.exists():
    text = digital.read_text(encoding="utf-8")
    text = re.sub(r"\s+tanks=\{tanks\}", "", text)
    digital.write_text(text, encoding="utf-8")
    print("OK: DigitalTwinPage.tsx")

# 3) Remover expected do PressureChart
operation = root / "frontend" / "src" / "pages" / "OperationPage.tsx"
if operation.exists():
    text = operation.read_text(encoding="utf-8")
    text = re.sub(r"\s+expected(?=[\s/>])", "", text)
    operation.write_text(text, encoding="utf-8")
    print("OK: OperationPage.tsx")

print("Correções aplicadas.")
