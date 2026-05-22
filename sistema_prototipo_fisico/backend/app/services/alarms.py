from app.models.domain import AlarmEvent


REQUIRED_ALARMS = [
    "PRESSURE_NOT_DROPPING",
    "PRESSURE_DROP_TOO_FAST",
    "TANK_DIFFERENCE_HIGH",
    "TANK_LEAK_SUSPECTED",
    "HOSE_LOSS_HIGH",
    "ROOTS_UNSAFE_START",
    "MAX_CYCLE_TIME_EXCEEDED",
    "SENSOR_FAILURE_SIMULATED",
    "PLC_COMM_LOSS_SIMULATED",
    "OIL_INJECTION_FAILURE",
    "OIL_FLOW_LOW",
    "STRUCTURAL_COLLAPSE_RISK",
    "EMERGENCY_STOP",
]


def required_alarm_catalog() -> list[dict]:
    return [{"code": code, "implemented": True} for code in REQUIRED_ALARMS]


def deduplicate_recent_alarms(alarms: list[AlarmEvent]) -> list[AlarmEvent]:
    seen: set[tuple[str, int | None, int | None]] = set()
    unique: list[AlarmEvent] = []
    for alarm in alarms:
        key = (alarm.code, alarm.tank_id, alarm.hose_id)
        if key not in seen:
            seen.add(key)
            unique.append(alarm)
    return unique
