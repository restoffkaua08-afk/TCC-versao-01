from __future__ import annotations

import json
import random
import time
import urllib.request

BASE = "http://127.0.0.1:8020/api"

def get_json(path: str):
    with urllib.request.urlopen(BASE + path, timeout=3) as response:
        return json.loads(response.read().decode("utf-8"))

def post_json(path: str, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=3) as response:
        return json.loads(response.read().decode("utf-8"))

def main():
    print("Simulador PLC/ESP32 HTTP - TSEA")
    post_json("/hardware/mode", {"mode": "BANCADA_SEGURA"})

    elapsed = 0
    pressure = 1013.0

    while True:
        desired = get_json("/hardware/desired-outputs")
        outputs = desired.get("outputs", {})

        if outputs.get("pump_b1"):
            pressure = max(8.0, pressure * 0.88)
        else:
            pressure = min(1013.0, pressure + 2.0)

        if outputs.get("pump_b2"):
            pressure = max(6.0, pressure * 0.93)

        flow = 1.5 if outputs.get("oil_valve") else 0.0

        payload = {
            "elapsed_seconds": elapsed,
            "pressure_machine_mbar": round(pressure + random.uniform(-0.8, 0.8), 3),
            "pumps": {
                "b1": bool(outputs.get("pump_b1")),
                "b2": bool(outputs.get("pump_b2")),
                "oil": bool(outputs.get("oil_valve")),
            },
            "oil": {
                "flow_l_min": flow,
            },
            "hardware": {
                "sensor_online": True,
                "plc_online": True,
                "emergency": bool(outputs.get("emergency_stop")),
            },
            "event": "Simulador PLC enviou pacote HTTP",
        }

        result = post_json("/hardware/ingest", payload)

        post_json("/hardware/command-ack", {
            "command_id": desired.get("command_id"),
            "applied": True,
            "message": "Comando aplicado pelo simulador HTTP",
            "outputs": outputs,
        })

        print(
            f"t={elapsed}s pressao={payload['pressure_machine_mbar']} "
            f"modo={result.get('mode')} "
            f"b1={outputs.get('pump_b1')} "
            f"b2={outputs.get('pump_b2')} "
            f"oleo={outputs.get('oil_valve')}"
        )

        elapsed += 1
        time.sleep(1)

if __name__ == "__main__":
    main()