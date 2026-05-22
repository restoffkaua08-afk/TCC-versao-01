from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI(title="TSEA IHM Local API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"status": "online", "timestamp": datetime.now().isoformat()}

@app.get("/api/status")
def get_status():
    return {"plc": "simulado_online", "cycle": "pronta"}
