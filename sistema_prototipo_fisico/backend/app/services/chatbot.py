from app.models.domain import AlarmEvent, PressureReading, VacuumCycle


def answer(message: str, cycle: VacuumCycle | None, readings: list[PressureReading], alarms: list[AlarmEvent]) -> dict:
    text = message.lower()
    active = [alarm for alarm in alarms if not alarm.acknowledged]
    if "roots" in text:
        return {
            "answer": "A Roots Leybold RUVAC WSU2001 só deve partir quando a pressão média estiver abaixo do limite configurado na receita.",
            "intent": "roots_safety",
            "suggested_actions": ["Verificar pressão média", "Conferir receita", "Consultar alarmes de intertravamento"],
        }
    if "oleo" in text or "óleo" in text or "vazao" in text or "vazão" in text:
        low_flow = [item for item in readings if item.oil_flow_l_min < 1.8]
        return {
            "answer": f"A injeção de óleo tem {len(low_flow)} tanque(s) abaixo da vazão mínima simulada." if low_flow else "A injeção de óleo está dentro do perfil simulado.",
            "intent": "oil_injection",
            "suggested_actions": ["Conferir vazão por tanque", "Verificar alarme OIL_FLOW_LOW"],
        }
    if "alarme" in text or "falha" in text:
        return {
            "answer": f"Existem {len(active)} alarmes ativos no processo TSEA.",
            "intent": "alarms",
            "suggested_actions": ["Abrir tela de Alarmes", "Reconhecer eventos tratados"],
        }
    if "press" in text or "vacuo" in text or "vácuo" in text:
        if not readings:
            value = "sem leitura de ciclo ativo"
        else:
            avg = sum(item.pressure_mbar for item in readings) / len(readings)
            value = f"média de {avg:.2f} mbar em {len(readings)} tanque(s)"
        return {
            "answer": f"O ciclo {cycle.cycle_code if cycle else 'sem ciclo'} esta com {value}.",
            "intent": "process_status",
            "suggested_actions": ["Abrir Operação", "Comparar com Gêmeo Digital"],
        }
    if "mangueira" in text or "perda" in text:
        max_loss = max([item.hose_loss_mbar for item in readings], default=0)
        return {
            "answer": f"A maior perda de carga simulada por mangueira é {max_loss:.2f} mbar.",
            "intent": "hose_loss",
            "suggested_actions": ["Abrir Mangueiras", "Rodar what-if com outra mangueira"],
        }
    return {
        "answer": "Posso orientar o operador TSEA sobre vácuo, tanques, Roots, óleo, alarmes, mangueiras, risco estrutural e histórico de ciclos.",
        "intent": "help",
        "suggested_actions": ["Perguntar sobre pressão", "Perguntar sobre Roots", "Perguntar sobre óleo"],
    }
