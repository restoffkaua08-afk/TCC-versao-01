from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings


def _fallback_response(message: str, context: dict[str, Any]) -> dict[str, Any]:
    text = message.lower()
    active_alarms = context.get("active_alarms", [])
    twin = context.get("digital_twin", {})
    state = context.get("operation_state", {})

    if "colapso" in text or "risco" in text:
        return {
            "answer": (
                f"O maior risco estrutural atual é {context.get('max_risk_pct', 0)}%. "
                "No protótipo, risco elevado indica que a queda de pressão não está sendo compensada adequadamente pelo óleo. "
                "A ação recomendada é pausar o vácuo, validar a injeção de óleo e revisar a receita antes de continuar."
            ),
            "intent": "structural_risk",
            "suggested_actions": ["Abrir Gêmeo Digital", "Executar cenário de óleo atrasado", "Verificar alarmes críticos"],
        }

    if "roots" in text or "bomba" in text:
        roots = state.get("roots_pump", {})
        return {
            "answer": (
                f"A Roots WSU2001 está com status: {'ligada' if roots.get('running') else 'bloqueada/desligada'}. "
                f"A partida segura configurada é {roots.get('safe_start_pressure_mbar', '--')} mbar. "
                "O intertravamento evita que ela seja acionada quando a pressão ainda está alta."
            ),
            "intent": "roots_status",
            "suggested_actions": ["Ver status da operação", "Executar cenário Roots fora da faixa", "Consultar alarmes"],
        }

    if "alarme" in text or "falha" in text:
        return {
            "answer": (
                f"Existem {len(active_alarms)} alarmes recentes no contexto enviado ao assistente. "
                "Priorize alarmes críticos relacionados a óleo, sensor, Roots e risco estrutural."
            ),
            "intent": "alarms",
            "suggested_actions": ["Abrir tela de alarmes", "Executar diagnóstico do Gêmeo Digital"],
        }

    if "gêmeo" in text or "gemeo" in text or "digital" in text:
        return {
            "answer": (
                f"O Gêmeo Digital está indicando gargalo: {twin.get('bottleneck', 'aguardando dados')}. "
                "Ele compara a pressão simulada com a pressão esperada, avalia desvio, risco estrutural e recomenda ações."
            ),
            "intent": "digital_twin",
            "suggested_actions": ["Executar cenário seguro", "Executar cenário de falha", "Ver comparação por tanque"],
        }

    return {
        "answer": (
            "Sou o assistente técnico do protótipo TSEA. Posso explicar pressão, óleo, Roots, alarmes, cenários, "
            "risco de colapso e recomendações do Gêmeo Digital. Sem chave OpenAI configurada, estou usando o modo local."
        ),
        "intent": "fallback_help",
        "suggested_actions": ["Perguntar sobre risco", "Perguntar sobre Roots", "Perguntar sobre alarmes"],
    }


def answer_with_ai_or_fallback(message: str, context: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()

    if not settings.openai_api_key:
        return _fallback_response(message, context)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)

        instructions = """
Você é o assistente técnico do Sistema TSEA de vácuo em tanques de reguladores.
Responda em português claro, técnico e compreensível para operador, supervisor e banca.
Use apenas o contexto fornecido pelo backend.
Não invente dados reais de fábrica.
Deixe explícito quando algo for simulado.
Quando houver risco crítico, explique a causa provável e recomende ação segura.
Não dê instruções para operar máquina real sem validação de engenharia, CLP, sensores e responsáveis técnicos.
"""

        payload = {
            "mensagem_usuario": message,
            "contexto_sistema": context,
        }

        response = client.responses.create(
            model=settings.openai_model,
            instructions=instructions,
            input=json.dumps(payload, ensure_ascii=False),
        )

        return {
            "answer": response.output_text,
            "intent": "openai_contextual_assistant",
            "suggested_actions": ["Ver Gêmeo Digital", "Executar cenário", "Abrir alarmes"],
        }
    except Exception as exc:
        fallback = _fallback_response(message, context)
        fallback["answer"] = (
            "Não consegui consultar a OpenAI neste momento. "
            f"Motivo técnico: {type(exc).__name__}. "
            + fallback["answer"]
        )
        fallback["intent"] = "openai_fallback"
        return fallback
