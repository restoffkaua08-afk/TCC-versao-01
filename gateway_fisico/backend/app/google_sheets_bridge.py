from __future__ import annotations

import base64
import hashlib
import importlib
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import csv
import io

os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from fastapi import APIRouter, HTTPException, Query, Request as FastAPIRequest
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

try:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except Exception:
    GoogleAuthRequest = None
    Credentials = None
    Flow = None
    build = None
    HttpError = None

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

CLIENT_SECRET_FILE = DATA_DIR / "google_oauth_client_secret.local.json"
TOKEN_FILE = DATA_DIR / "google_oauth_token.local.json"
OAUTH_STATE_FILE = DATA_DIR / "google_oauth_state.local.json"
GENERATED_FILE = DATA_DIR / "google_sheets_generated.local.json"

REDIRECT_URI = "http://127.0.0.1:8020/api/google-oauth/callback"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


class GoogleSheetsGeneratePayload(BaseModel):
    metric: str = Field(default="operations_by_day")
    chart_type: str = Field(default="bar")
    period: str = Field(default="month")
    title: str = Field(default="")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _error_text(error: Exception) -> str:
    text = str(error)

    try:
        import traceback
        print("[TSEA GOOGLE SHEETS GENERATE ERROR]")
        print(traceback.format_exc())
    except Exception:
        pass

    reason = getattr(error, "reason", None)
    if reason:
        text = f"{text} {reason}".strip()

    content = getattr(error, "content", None)
    if content:
        try:
            if isinstance(content, bytes):
                content_text = content.decode("utf-8", errors="replace")
            else:
                content_text = str(content)

            text = f"{text} {content_text}".strip()
        except Exception:
            pass

    if not text:
        text = error.__class__.__name__

    return text[:1800]


def _dependencies_ok() -> bool:
    return all([GoogleAuthRequest, Credentials, Flow, build])


def _read_json(path: Path, fallback: Any) -> Any:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not path.exists():
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _write_json(path: Path, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _pkce_verifier() -> str:
    verifier = secrets.token_urlsafe(64)
    return verifier[:96]


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def _charts_bridge():
    return importlib.import_module("app.charts_bridge")


def _ensure_dependencies() -> None:
    if not _dependencies_ok():
        raise HTTPException(
            status_code=400,
            detail="Dependencias Google ausentes. Instale google-api-python-client, google-auth, google-auth-oauthlib e google-auth-httplib2.",
        )


def _ensure_client_secret() -> None:
    if not CLIENT_SECRET_FILE.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Arquivo OAuth nao encontrado. Salve o client_secret em: {CLIENT_SECRET_FILE}",
        )


def _flow() -> Any:
    _ensure_dependencies()
    _ensure_client_secret()

    try:
        return Flow.from_client_secrets_file(
            str(CLIENT_SECRET_FILE),
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
            autogenerate_code_verifier=False,
        )
    except TypeError:
        return Flow.from_client_secrets_file(
            str(CLIENT_SECRET_FILE),
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )


def _credentials() -> Any | None:
    _ensure_dependencies()

    if not TOKEN_FILE.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    except Exception:
        return None

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleAuthRequest())
            TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
        except Exception:
            return None

    if creds and creds.valid:
        return creds

    return None


def _service() -> Any:
    creds = _credentials()

    if not creds:
        raise HTTPException(status_code=401, detail="Google OAuth nao autorizado.")

    return build("sheets", "v4", credentials=creds)


def _drive_service() -> Any:
    creds = _credentials()

    if not creds:
        raise HTTPException(status_code=401, detail="Google OAuth nao autorizado.")

    return build("drive", "v3", credentials=creds)


def _chart_rows(chart: dict[str, Any]) -> list[dict[str, Any]]:
    labels = chart.get("labels") or []
    series = chart.get("series") or []
    first_series = series[0] if series and isinstance(series[0], dict) else {}
    values = first_series.get("data") or []
    series_name = first_series.get("name") or "Valor"

    rows: list[dict[str, Any]] = []

    for index, value in enumerate(values):
        label = labels[index] if index < len(labels) else index + 1
        rows.append(
            {
                "categoria": label,
                "valor": value,
                "serie": series_name,
            }
        )

    return rows


def _full_rows(chart: dict[str, Any]) -> list[dict[str, Any]]:
    table = chart.get("table") or []

    if isinstance(table, list) and table:
        rows: list[dict[str, Any]] = []

        for item in table:
            if isinstance(item, dict):
                rows.append(item)
            else:
                rows.append({"valor": item})

        return rows

    return _chart_rows(chart)


def _object_table(rows: list[dict[str, Any]]) -> list[list[Any]]:
    if not rows:
        return [["Sem dados"]]

    headers: list[str] = []

    for row in rows:
        for key in row.keys():
            if key not in headers:
                headers.append(key)

    values = [headers]

    for row in rows:
        values.append([_sheet_cell(row.get(header, "")) for header in headers])

    return values


def _sheet_cell(value: Any) -> str | int | float | bool:
    if value is None:
        return ""

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value

    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False)

    return str(value)


def _chart_type_google(chart_type: str) -> str:
    value = chart_type.lower().strip()

    if value == "line":
        return "LINE"

    if value == "pie":
        return "PIE"

    return "COLUMN"


def _build_chart_request(chart_type: str, title: str, data_sheet_id: int, dashboard_sheet_id: int, row_count: int) -> dict[str, Any]:
    chart_type_google = _chart_type_google(chart_type)

    if chart_type_google == "PIE":
        spec = {
            "title": title,
            "pieChart": {
                "legendPosition": "RIGHT_LEGEND",
                "domain": {
                    "sourceRange": {
                        "sources": [
                            {
                                "sheetId": data_sheet_id,
                                "startRowIndex": 1,
                                "endRowIndex": row_count + 1,
                                "startColumnIndex": 0,
                                "endColumnIndex": 1,
                            }
                        ]
                    }
                },
                "series": {
                    "sourceRange": {
                        "sources": [
                            {
                                "sheetId": data_sheet_id,
                                "startRowIndex": 1,
                                "endRowIndex": row_count + 1,
                                "startColumnIndex": 1,
                                "endColumnIndex": 2,
                            }
                        ]
                    }
                },
            },
        }
    else:
        spec = {
            "title": title,
            "basicChart": {
                "chartType": chart_type_google,
                "legendPosition": "RIGHT_LEGEND",
                "axis": [
                    {
                        "position": "BOTTOM_AXIS",
                        "title": "Categoria",
                    },
                    {
                        "position": "LEFT_AXIS",
                        "title": "Valor",
                    },
                ],
                "domains": [
                    {
                        "domain": {
                            "sourceRange": {
                                "sources": [
                                    {
                                        "sheetId": data_sheet_id,
                                        "startRowIndex": 0,
                                        "endRowIndex": row_count + 1,
                                        "startColumnIndex": 0,
                                        "endColumnIndex": 1,
                                    }
                                ]
                            }
                        }
                    }
                ],
                "series": [
                    {
                        "series": {
                            "sourceRange": {
                                "sources": [
                                    {
                                        "sheetId": data_sheet_id,
                                        "startRowIndex": 0,
                                        "endRowIndex": row_count + 1,
                                        "startColumnIndex": 1,
                                        "endColumnIndex": 2,
                                    }
                                ]
                            }
                        },
                        "targetAxis": "LEFT_AXIS",
                    }
                ],
                "headerCount": 1,
            },
        }

    return {
        "addChart": {
            "chart": {
                "spec": spec,
                "position": {
                    "overlayPosition": {
                        "anchorSheetId": dashboard_sheet_id,
                        "anchorRowIndex": 6,
                        "anchorColumnIndex": 0,
                        "widthPixels": 900,
                        "heightPixels": 500,
                    }
                },
            }
        }
    }


def _write_values(service: Any, spreadsheet_id: str, range_name: str, values: list[list[Any]]) -> None:
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        body={"values": values},
    ).execute()


@router.get("/api/google-oauth/status")
def api_google_oauth_status() -> dict[str, Any]:
    creds = None

    if _dependencies_ok() and TOKEN_FILE.exists():
        try:
            creds = _credentials()
        except Exception:
            creds = None

    return {
        "dependencies_available": _dependencies_ok(),
        "client_secret_exists": CLIENT_SECRET_FILE.exists(),
        "client_secret_path": str(CLIENT_SECRET_FILE),
        "authenticated": bool(creds),
        "redirect_uri": REDIRECT_URI,
        "scopes": SCOPES,
    }


@router.get("/api/google-oauth/start")
def api_google_oauth_start() -> dict[str, Any]:
    verifier = _pkce_verifier()
    challenge = _pkce_challenge(verifier)
    flow = _flow()

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        code_challenge=challenge,
        code_challenge_method="S256",
    )

    _write_json(
        OAUTH_STATE_FILE,
        {
            "state": state,
            "code_verifier": verifier,
            "created_at": _now_iso(),
        },
    )

    return {
        "ok": True,
        "auth_url": authorization_url,
        "state": state,
        "redirect_uri": REDIRECT_URI,
    }


@router.get("/api/google-oauth/callback", response_class=HTMLResponse)
def api_google_oauth_callback(
    request: FastAPIRequest,
    code: str = Query(default=""),
    state: str = Query(default=""),
    scope: str = Query(default=""),
    iss: str = Query(default=""),
) -> HTMLResponse:
    try:
        if not code:
            return HTMLResponse("<h2>Autorização cancelada.</h2>")

        stored = _read_json(OAUTH_STATE_FILE, {})
        verifier = str(stored.get("code_verifier") or "").strip()

        if stored.get("state") and state and stored.get("state") != state:
            return HTMLResponse(
                "<h2>Estado OAuth inválido.</h2><p>Feche esta janela e tente novamente pelo sistema.</p>",
                status_code=400,
            )

        if not verifier:
            return HTMLResponse(
                "<h2>Verifier OAuth ausente.</h2><p>Volte ao sistema e clique novamente em Entrar/Gerar no Google Planilhas.</p>",
                status_code=400,
            )

        flow = _flow()
        flow.fetch_token(
            authorization_response=str(request.url),
            code_verifier=verifier,
        )

        creds = flow.credentials
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")

        return HTMLResponse(
            """
            <!doctype html>
            <html lang="pt-BR">
            <head>
              <meta charset="utf-8" />
              <title>Google autorizado</title>
              <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: grid; place-items: center; min-height: 100vh; margin: 0; }
                main { max-width: 560px; background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 24px; text-align: center; }
                h1 { margin: 0 0 10px; }
                p { color: #cbd5e1; }
              </style>
            </head>
            <body>
              <main>
                <h1>Google Planilhas autorizado</h1>
                <p>Volte ao sistema TSEA V-Twin. Esta janela pode ser fechada.</p>
              </main>
              <script>
                setTimeout(function () {
                  try { window.close(); } catch (e) {}
                }, 1800);
              </script>
            </body>
            </html>
            """
        )

    except Exception:
        import traceback

        detail = traceback.format_exc()
        print("[TSEA GOOGLE OAUTH CALLBACK ERROR]")
        print(detail)

        safe_detail = (
            detail.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        return HTMLResponse(
            f"""
            <!doctype html>
            <html lang="pt-BR">
            <head>
              <meta charset="utf-8" />
              <title>Erro OAuth</title>
              <style>
                body {{ font-family: Arial, sans-serif; background: #111827; color: #fff; padding: 24px; }}
                pre {{ background: #020617; color: #fecaca; padding: 16px; border-radius: 12px; white-space: pre-wrap; }}
              </style>
            </head>
            <body>
              <h1>Erro no callback OAuth</h1>
              <pre>{safe_detail}</pre>
            </body>
            </html>
            """,
            status_code=500,
        )


@router.post("/api/google-oauth/logout")
def api_google_oauth_logout() -> dict[str, Any]:
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()

    if OAUTH_STATE_FILE.exists():
        OAUTH_STATE_FILE.unlink()

    return {"ok": True, "authenticated": False}



@router.get("/api/google-sheets/debug")
def api_google_sheets_debug() -> dict[str, Any]:
    """Retorna diagnostico seguro sobre o estado da integracao Google (sem expor segredos)."""
    result: dict[str, Any] = {
        "dependencies_available": _dependencies_ok(),
        "client_secret_exists": CLIENT_SECRET_FILE.exists(),
        "token_exists": TOKEN_FILE.exists(),
        "required_scopes": SCOPES,
    }

    creds = None

    if TOKEN_FILE.exists() and _dependencies_ok():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception:
            creds = None

    if creds:
        result.update({
            "token_valid": bool(creds.valid),
            "token_expired": bool(getattr(creds, "expired", False)),
            "has_refresh_token": bool(getattr(creds, "refresh_token", None)),
        })

        scopes = getattr(creds, "scopes", None)
        if scopes is None:
            # some credential objects store scope in token_response
            token_response = getattr(creds, "token_response", {}) or {}
            scopes = token_response.get("scope")

        if isinstance(scopes, str):
            scopes = scopes.split()

        result["token_scopes"] = list(scopes) if scopes else []

        result["missing_scopes"] = [s for s in SCOPES if s not in (scopes or [])]

        # Attempt simple Sheets and Drive calls to verify API reachability
        try:
            service = build("sheets", "v4", credentials=creds)
            # If there's a generated spreadsheet, try to fetch its metadata, else skip test
            generated = _read_json(GENERATED_FILE, [])
            if isinstance(generated, list) and generated:
                last = generated[-1]
                try:
                    service.spreadsheets().get(spreadsheetId=last.get("spreadsheet_id"), fields="spreadsheetId").execute()
                    result["sheets_api_call"] = "ok"
                except Exception as e:
                    result["sheets_api_call"] = f"error: {_error_text(e)}"
            else:
                result["sheets_api_call"] = "no_generated_spreadsheet_to_test"
        except Exception as e:
            result["sheets_api_call"] = f"error: {_error_text(e)}"

        try:
            drive = build("drive", "v3", credentials=creds)
            try:
                drive.files().list(pageSize=1).execute()
                result["drive_api_call"] = "ok"
            except Exception as e:
                result["drive_api_call"] = f"error: {_error_text(e)}"
        except Exception as e:
            result["drive_api_call"] = f"error: {_error_text(e)}"

    else:
        result.update({"token_valid": False, "token_expired": None, "has_refresh_token": False, "token_scopes": [], "missing_scopes": SCOPES})

    # do not expose secrets
    return result



@router.post("/api/google-oauth/reset")
def api_google_oauth_reset() -> dict[str, Any]:
    if TOKEN_FILE.exists():
        try:
            TOKEN_FILE.unlink()
        except Exception:
            pass

    if OAUTH_STATE_FILE.exists():
        try:
            OAUTH_STATE_FILE.unlink()
        except Exception:
            pass

    return {"ok": True}


@router.get("/api/google-sheets/status")
def api_google_sheets_status() -> dict[str, Any]:
    oauth = api_google_oauth_status()
    generated = _read_json(GENERATED_FILE, [])

    if not isinstance(generated, list):
        generated = []

    return {
        **oauth,
        "generated": generated[-20:][::-1],
    }


@router.post("/api/google-sheets/generate-chart")
def api_google_sheets_generate_chart(payload: GoogleSheetsGeneratePayload) -> dict[str, Any]:
    try:
        _ensure_dependencies()
        oauth = api_google_oauth_status()

        if not oauth["client_secret_exists"]:
            raise HTTPException(status_code=400, detail=f"Arquivo OAuth nao encontrado: {CLIENT_SECRET_FILE}")

        if not oauth["authenticated"]:
            auth = api_google_oauth_start()
            raise HTTPException(status_code=401, detail={"auth_required": True, "auth_url": auth["auth_url"]})

        service = _service()

        charts = _charts_bridge()
        chart = charts.api_statistics(
            metric=payload.metric,
            chart_type=payload.chart_type,
            period=payload.period,
            date_start=None,
            date_end=None,
        )

        title = payload.title.strip() or chart.get("title") or "Grafico TSEA V-Twin"
        chart_rows = _chart_rows(chart)
        full_rows = _full_rows(chart)

        if not chart_rows:
            chart_rows = [
                {
                    "categoria": "Sem registros",
                    "valor": 0,
                    "serie": "Valor",
                }
            ]

            if not full_rows:
                full_rows = [
                    {
                        "status": "Sem registros reais suficientes",
                        "metric": payload.metric,
                        "period": payload.period,
                    }
                ]

        # Prepare values to write (do this before attempting remote creation so fallback can reuse)
        chart_values = [["Categoria", "Valor"]] + [[_sheet_cell(row["categoria"]), _sheet_cell(row["valor"])] for row in chart_rows]
        full_values = _object_table(full_rows)
        dashboard_values = [
            [title],
            [f"Indicador: {payload.metric}"],
            [f"Tipo: {payload.chart_type}"],
            [f"Período: {payload.period}"],
            [f"Gerado em: {_now_iso()}"],
            [f"Fonte: {chart.get('meta', {}).get('source', 'TSEA V-Twin')}"],
        ]

        # Try to create spreadsheet via Sheets API; if forbidden, fallback to Drive API creation
        try:
            spreadsheet = service.spreadsheets().create(
                body={
                    "properties": {
                        "title": title,
                        "locale": "pt_BR",
                    }
                },
                fields="spreadsheetId,spreadsheetUrl,sheets.properties",
            ).execute()

            spreadsheet_id = spreadsheet["spreadsheetId"]
            spreadsheet_url = spreadsheet.get("spreadsheetUrl")
            data_sheet_id = spreadsheet["sheets"][0]["properties"]["sheetId"]

        except Exception as create_error:
            # If create is forbidden, try Drive API as fallback
            print(f"[TSEA GOOGLE SHEETS] sheets.create failed: {create_error}")

            try:
                drive = _drive_service()
                file_metadata = {"name": title, "mimeType": "application/vnd.google-apps.spreadsheet"}
                file = drive.files().create(body=file_metadata, fields="id,webViewLink").execute()
                spreadsheet_id = file.get("id")
                spreadsheet_url = file.get("webViewLink") or f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"

                # Retrieve sheet properties via Sheets API
                fresh = service.spreadsheets().get(spreadsheetId=spreadsheet_id, fields="sheets.properties").execute()
                data_sheet_id = fresh.get("sheets", [])[0].get("properties", {}).get("sheetId")

            except Exception as drive_error:
                print(f"[TSEA GOOGLE SHEETS] drive.create fallback failed: {drive_error}")

                # As último recurso para apresentações, exportar os dados como CSV local e retornar ao frontend
                try:
                    now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
                    filename = f"tsea_chart_fallback_{now}.csv"

                    # montar CSV com Dados_Grafico e Dados_Completos separados por seção
                    output = io.StringIO()
                    writer = csv.writer(output)

                    writer.writerow(["# Dados_Grafico"])
                    for row in chart_values:
                        writer.writerow(row)

                    writer.writerow([])
                    writer.writerow(["# Dados_Completos"])
                    for row in full_values:
                        # full_values is a table (list of rows)
                        writer.writerow([str(cell) for cell in row])

                    csv_text = output.getvalue()
                    csv_b64 = base64.b64encode(csv_text.encode("utf-8")).decode("ascii")

                    # Also prepare an HTML fallback with embedded Chart.js so user sees a chart in browser
                    try:
                        labels = [str(r[0]) for r in chart_values[1:]]
                        values = [r[1] for r in chart_values[1:]]

                        labels_json = json.dumps(labels)
                        values_json = json.dumps(values)
                        title_json = json.dumps(title)
                        chart_type_js = 'line' if payload.chart_type == 'line' else 'bar' if payload.chart_type == 'bar' else 'pie'

                        # prepare colors: single color for bar/line, palette for pie
                        palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
                        if chart_type_js == 'pie':
                            colors = [palette[i % len(palette)] for i in range(len(values))]
                        else:
                            colors = [palette[0]]

                        colors_json = json.dumps(colors)

                        # Attempt to inline Chart.js to make the HTML fallback work when opened
                        # as a local/data URL where external script loading may be blocked.
                        chartjs_script = '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
                        try:
                            import requests as _requests

                            _r = _requests.get('https://cdn.jsdelivr.net/npm/chart.js', timeout=3)
                            if _r.status_code == 200 and _r.text:
                                # wrap the minified script inline
                                chartjs_script = f"<script>{_r.text}</script>"
                        except Exception:
                            # fallback to CDN tag if inline fetch fails
                            chartjs_script = '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'

                        html = f"""
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>{title} - Fallback Chart</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>body{{font-family:Arial,Helvetica,sans-serif;margin:24px}}.card{{max-width:1000px;margin:0 auto}}canvas{{width:100% !important;height:auto !important}}</style>
</head>
<body>
    <div class="card">
        <h2>{title} (Fallback)</h2>
        <canvas id="tseaChart" width="900" height="500"></canvas>
    </div>
    {chartjs_script}
    <script>
        const labels = {labels_json};
        const values = {values_json};
        const colors = {colors_json};

        const ctx = document.getElementById('tseaChart').getContext('2d');

        const datasets = [];
        if ('{chart_type_js}' === 'pie') {{
            datasets.push({{
                data: values,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 1
            }});
        }} else {{
            // use a single color for bar/line
            const bg = colors[0] || '#1f77b4';
            datasets.push({{
                label: {title_json},
                data: values,
                backgroundColor: bg,
                borderColor: bg,
                borderWidth: 1,
            }});
        }}

        const config = {{
            type: '{chart_type_js}',
            data: {{ labels: labels, datasets }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: true, position: 'bottom' }} }},
                scales: {{
                    y: {{ beginAtZero: true }}
                }}
            }}
        }};

        new Chart(ctx, config);
    </script>
</body>
</html>
"""

                        html_b64 = base64.b64encode(html.encode('utf-8')).decode('ascii')
                        html_filename = f"tsea_chart_fallback_{now}.html"
                    except Exception:
                        html_b64 = None
                        html_filename = None

                    # Also prepare an Excel (.xlsx) fallback with embedded chart using XlsxWriter
                    try:
                        try:
                            import xlsxwriter
                        except Exception:
                            xlsxwriter = None

                        xlsx_b64 = None
                        xlsx_filename = None

                        if xlsxwriter:
                            output_xlsx = io.BytesIO()
                            workbook = xlsxwriter.Workbook(output_xlsx, {'in_memory': True})
                            ws = workbook.add_worksheet('Dados_Grafico')
                            # formats
                            header_fmt = workbook.add_format({'bold': True, 'bg_color': '#F2F2F2', 'border': 1})
                            num_fmt = workbook.add_format({'num_format': '#,##0.##'})

                            # write headers
                            for ci, header in enumerate(chart_values[0]):
                                ws.write(0, ci, header, header_fmt)

                            # write data
                            for ri, row in enumerate(chart_values[1:], start=1):
                                for ci, cell in enumerate(row):
                                    if isinstance(cell, (int, float)):
                                        ws.write_number(ri, ci, cell, num_fmt)
                                    else:
                                        ws.write(ri, ci, cell)

                            # set column widths
                            try:
                                ws.set_column(0, 0, 24)
                                ws.set_column(1, 1, 16)
                            except Exception:
                                pass

                            # create chart
                            ct = 'column' if payload.chart_type not in ('line', 'pie') else ('line' if payload.chart_type == 'line' else 'pie')
                            chart = workbook.add_chart({'type': ct})

                            # prepare colors
                            palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]

                            # series refers to sheet data (exclude header)
                            row_count = max(1, len(chart_values) - 1)
                            # categories in A2:A{n+1}, values in B2:B{n+1}
                            if ct == 'pie':
                                # pie: set color per point
                                points = []
                                for i in range(row_count):
                                    points.append({'fill': {'color': palette[i % len(palette)]}})

                                chart.add_series({
                                    'name': title,
                                    'categories': ['Dados_Grafico', 1, 0, row_count, 0],
                                    'values': ['Dados_Grafico', 1, 1, row_count, 1],
                                    'points': points,
                                })
                            else:
                                chart.add_series({
                                    'name': title,
                                    'categories': ['Dados_Grafico', 1, 0, row_count, 0],
                                    'values': ['Dados_Grafico', 1, 1, row_count, 1],
                                    'fill': {'color': palette[0]},
                                })

                            chart.set_title({'name': title})
                            chart.set_legend({'position': 'bottom'})
                            # insert chart
                            ws_chart_row = row_count + 3
                            ws.insert_chart(ws_chart_row, 0, chart, {'x_scale': 2.0, 'y_scale': 1.2})

                            workbook.close()
                            output_xlsx.seek(0)
                            xlsx_bytes = output_xlsx.read()
                            xlsx_b64 = base64.b64encode(xlsx_bytes).decode('ascii')
                            xlsx_filename = f"tsea_chart_fallback_{now}.xlsx"
                    except Exception:
                        xlsx_b64 = None
                        xlsx_filename = None

                    item = {
                        "title": title,
                        "metric": payload.metric,
                        "chart_type": payload.chart_type,
                        "period": payload.period,
                        "generated_at": _now_iso(),
                        "generated_local": True,
                        "fallback_csv_filename": filename,
                    }

                    generated = _read_json(GENERATED_FILE, [])
                    if not isinstance(generated, list):
                        generated = []

                    generated.append(item)
                    _write_json(GENERATED_FILE, generated[-100:])

                    result = {"ok": True, **item, "fallback_csv_base64": csv_b64}
                    if html_b64:
                        result["fallback_html_base64"] = html_b64
                        result["fallback_html_filename"] = html_filename
                    if xlsx_b64:
                        result["fallback_xlsx_base64"] = xlsx_b64
                        result["fallback_xlsx_filename"] = xlsx_filename

                    return result
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Falha ao exportar CSV de fallback: {_error_text(e)}")

        _write_values(service, spreadsheet_id, "Dados_Grafico!A1:B" + str(len(chart_values)), chart_values)
        _write_values(service, spreadsheet_id, "Dados_Completos!A1", full_values)
        _write_values(service, spreadsheet_id, "Grafico!A1:A6", dashboard_values)

        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "requests": [
                    {
                        "updateSheetProperties": {
                            "properties": {
                                "sheetId": data_sheet_id,
                                "title": "Dados_Grafico",
                                "gridProperties": {"frozenRowCount": 1},
                            },
                            "fields": "title,gridProperties.frozenRowCount",
                        }
                    },
                    {
                        "addSheet": {
                            "properties": {
                                "title": "Dados_Completos",
                                "gridProperties": {"frozenRowCount": 1},
                            }
                        }
                    },
                    {
                        "addSheet": {
                            "properties": {
                                "title": "Grafico",
                            }
                        }
                    },
                ]
            },
        ).execute()

        fresh = service.spreadsheets().get(
            spreadsheetId=spreadsheet_id,
            fields="sheets.properties",
        ).execute()

        sheet_ids = {
            item["properties"]["title"]: item["properties"]["sheetId"]
            for item in fresh.get("sheets", [])
        }

        data_sheet_id = sheet_ids.get("Dados_Grafico", data_sheet_id)
        full_sheet_id = sheet_ids.get("Dados_Completos")
        dashboard_sheet_id = sheet_ids.get("Grafico")


        requests: list[dict[str, Any]] = [
            {
                "repeatCell": {
                    "range": {"sheetId": data_sheet_id, "startRowIndex": 0, "endRowIndex": 1},
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.86, "green": 0.92, "blue": 0.99},
                            "textFormat": {"bold": True},
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat)",
                }
            },
            {
                "autoResizeDimensions": {
                    "dimensions": {
                        "sheetId": data_sheet_id,
                        "dimension": "COLUMNS",
                        "startIndex": 0,
                        "endIndex": 2,
                    }
                }
            },
        ]

        if full_sheet_id is not None:
            requests.append(
                {
                    "autoResizeDimensions": {
                        "dimensions": {
                            "sheetId": full_sheet_id,
                            "dimension": "COLUMNS",
                            "startIndex": 0,
                            "endIndex": min(26, len(full_values[0]) if full_values else 1),
                        }
                    }
                }
            )

        if dashboard_sheet_id is not None:
            requests.append(
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": dashboard_sheet_id,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": 1,
                        },
                        "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 18}}},
                        "fields": "userEnteredFormat(textFormat)",
                    }
                }
            )

            requests.append(_build_chart_request(payload.chart_type, title, data_sheet_id, dashboard_sheet_id, len(chart_rows)))

        try:
            service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={"requests": requests},
            ).execute()
        except Exception as chart_error:
            print(f"[TSEA GOOGLE SHEETS] Planilha criada, mas formatacao/grafico falhou: {chart_error}")

        generated = _read_json(GENERATED_FILE, [])

        if not isinstance(generated, list):
            generated = []

        item = {
            "title": title,
            "metric": payload.metric,
            "chart_type": payload.chart_type,
            "period": payload.period,
            "spreadsheet_url": spreadsheet_url,
            "spreadsheet_id": spreadsheet_id,
            "rows_sent": len(chart_rows),
            "generated_at": _now_iso(),
        }

        generated.append(item)
        _write_json(GENERATED_FILE, generated[-100:])

        return {"ok": True, **item}

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Falha ao gerar no Google Planilhas: {_error_text(error)}")
