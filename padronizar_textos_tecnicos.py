from pathlib import Path
import re

root = Path.cwd()
targets = []

for folder in [root / "frontend" / "src", root / "frontend" / "public"]:
    if folder.exists():
        for ext in ("*.tsx", "*.ts", "*.jsx", "*.js", "*.html", "*.css", "*.md"):
            targets.extend(folder.rglob(ext))

REPLACEMENTS = [
    # Remoção de termos que enfraquecem a proposta
    ("protótipo técnico avançado", "plataforma operacional"),
    ("protótipo demonstrativo", "plataforma operacional"),
    ("protótipo", "sistema"),
    ("fase de demonstração", "fase operacional"),
    ("versão demonstrativa", "versão operacional"),
    ("demonstrativo", "operacional"),
    ("demonstração", "operação"),
    ("educativo", "operacional"),
    ("demonstra a ideia", "implementa a lógica operacional"),
    ("serve para demonstrar", "permite executar"),
    ("prova o conceito", "valida a solução"),
    ("cenários de demonstração", "cenários operacionais"),
    ("simulação demonstrativa", "simulação operacional"),

    # Nomes mais técnicos e claros
    ("Registros e Histórico", "Histórico Operacional"),
    ("Operações reais", "Ciclos Operacionais"),
    ("Simulações", "Simulações Operacionais"),
    ("Simulação", "Simulação Operacional"),
    ("Operação segura", "Ciclo Operacional Estável"),
    ("Óleo insuficiente", "Baixa Vazão de Óleo"),
    ("Óleo atrasado", "Atraso na Injeção de Óleo"),
    ("Mangueira longa", "Perda de Carga por Mangueira"),
    ("Vazamento", "Perda de Vedação"),
    ("Bomba desgastada", "Perda de Eficiência da Bomba"),
    ("Tanque crítico", "Condição Crítica de Processo"),
    ("Ver", "Abrir Detalhes"),
    ("Simular novamente", "Reexecutar Simulação"),
    ("Re-simular", "Reexecutar Simulação"),
    ("Converter para operação real", "Enviar para Execução"),
    ("Gerar relatório", "Gerar Relatório Técnico"),
    ("Exportar CSV", "Exportar Dados CSV"),
    ("Histórico operacional", "Histórico Técnico Operacional"),
    ("Operações reais e simulações agora ficam separadas", "Separação estruturada entre ciclos operacionais e simulações"),
    ("Use filtros diferentes para operação real e simulação. O objetivo é facilitar auditoria e reuso técnico.", "Use os filtros para localizar ciclos, simulações e parâmetros operacionais com precisão."),
    ("API verificando", "Sincronizando API"),
    ("API online", "API Ativa"),
    ("API offline", "API Inativa"),

    # Termos técnicos mais claros
    ("Roots liga em", "Pressão de Acionamento da Bomba Roots"),
    ("Vazão de óleo", "Vazão de Injeção de Óleo"),
    ("Atraso do óleo", "Atraso da Injeção de Óleo"),
    ("Saúde da bomba", "Índice de Integridade da Bomba"),
    ("Calibração", "Fator de Calibração"),
    ("Pressão final", "Pressão Final do Processo"),
    ("Pressão efetiva máx.", "Pressão Efetiva Máxima"),
    ("Risco máximo", "Índice Máximo de Risco"),
    ("Margem de segurança", "Margem Operacional de Segurança"),
    ("Risco de colapso", "Risco Estrutural"),
    ("Status", "Estado Operacional"),
    ("Tanque", "Tanque de Processo"),
    ("Mangueira", "Linha de Vácuo"),
    ("Tipo", "Categoria"),
    ("Data/Hora", "Data e Hora"),
    ("Operador", "Responsável Operacional"),
    ("Detalhes da operação real", "Detalhamento do Ciclo Operacional"),
    ("Detalhes da simulação", "Detalhamento da Simulação Operacional"),
    ("Parâmetros da operação", "Parâmetros Operacionais"),
    ("Parâmetros da simulação", "Parâmetros da Simulação"),
    ("Resultados", "Resultados Operacionais"),
    ("Resultados simulados", "Resultados da Simulação"),
    ("Gráfico completo", "Curva Operacional Completa"),
    ("Gráfico da simulação", "Curva da Simulação"),
    ("Eventos e alarmes", "Eventos de Processo e Alarmes"),
    ("Alertas gerados", "Alertas Operacionais"),
    ("Voltar ao sistema", "Retornar ao Painel Principal"),
    ("Atualizar", "Atualizar Dados"),
]

REMOVE_PATTERNS = [
    r".*protótipo.*\n?",
    r".*demonstração.*\n?",
    r".*versão demonstrativa.*\n?",
    r".*fase de demonstração.*\n?",
    r".*prova o conceito.*\n?",
    r".*serve para demonstrar.*\n?",
    r".*este sistema.*educativo.*\n?",
]

def clean_text(text: str) -> str:
    original = text

    for old, new in REPLACEMENTS:
        text = text.replace(old, new)

    for pattern in REMOVE_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    # Limpeza de duplicações comuns após replace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)

    # Pequenos refinamentos de linguagem
    text = text.replace("simulação operacional operacional", "simulação operacional")
    text = text.replace("Ciclos Operacionais Operacionais", "Ciclos Operacionais")
    text = text.replace("Histórico Operacional Operacional", "Histórico Operacional")

    return text

changed = 0

for file in targets:
    try:
        content = file.read_text(encoding="utf-8")
    except Exception:
        continue

    updated = clean_text(content)

    if updated != content:
        file.write_text(updated, encoding="utf-8")
        print(f"OK: {file.relative_to(root)}")
        changed += 1

print(f"Arquivos alterados: {changed}")
