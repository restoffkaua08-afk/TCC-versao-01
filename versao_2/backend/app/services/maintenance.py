from statistics import mean

from app.models.domain import Hose, MaintenanceInsight, PressureReading


def predict_maintenance(readings: list[PressureReading], hoses: list[Hose]) -> list[MaintenanceInsight]:
    insights: list[MaintenanceInsight] = []
    avg_loss = mean([r.hose_loss_mbar for r in readings]) if readings else 0
    avg_risk = mean([r.collapse_risk_pct for r in readings]) if readings else 0
    primary_risk = min(100, avg_loss * 1.7 + avg_risk * 0.35)
    roots_risk = min(100, avg_loss * 1.25 + max(0, avg_risk - 70) * 1.1)
    insights.append(
        MaintenanceInsight(
            asset_type="pump",
            asset_code="Leybold SOGEVAC SV630B",
            risk_score=round(primary_risk, 2),
            remaining_hours=round(max(24, 900 - primary_risk * 7.5), 1),
            recommendation="Verificar nível de óleo, filtros e vibração da bomba primária SV630B." if primary_risk > 45 else "Bomba primária dentro do perfil simulado.",
        )
    )
    insights.append(
        MaintenanceInsight(
            asset_type="pump",
            asset_code="Leybold RUVAC WSU2001",
            risk_score=round(roots_risk, 2),
            remaining_hours=round(max(24, 1100 - roots_risk * 8.2), 1),
            recommendation="Inspecionar intertravamento, acoplamento e aquecimento da Roots WSU2001." if roots_risk > 45 else "Roots dentro do perfil simulado.",
        )
    )
    for hose in hoses:
        risk = min(100, hose.usage_cycles * 0.32 + hose.loss_factor * 20 + (12 if hose.status == "attention" else 0))
        insights.append(
            MaintenanceInsight(
                asset_type="hose",
                asset_code=hose.code,
                risk_score=round(risk, 2),
                remaining_hours=round(max(16, 520 - risk * 4.4), 1),
                recommendation="Substituir ou ensaiar estanqueidade da mangueira." if risk > 60 else "Mangueira apta para uso simulado.",
            )
        )
    return insights
