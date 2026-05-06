# TSEA Sistema

Protótipo industrial para controle simulado do processo de vácuo em até 3 tanques de reguladores da TSEA.

O sistema representa o processo TSEA com tanques, mangueiras, receitas, bomba primária Leybold SOGEVAC SV630B, bomba Roots Leybold RUVAC WSU2001, injeção de óleo, risco estrutural, alarmes industriais, rastreabilidade, histórico, Gêmeo Digital, what-if, manutenção preditiva, relatórios e assistente do operador.

## Estrutura

- `backend/`: API FastAPI, SQLite, models SQLModel, engine TSEA, alarmes, rastreabilidade e serviços analíticos.
- `frontend/`: supervisório React/TypeScript com navegação executiva e técnica.
- `docs/`: documentação técnica e operacional.

## Executar Backend

```powershell
cd backend
uv venv .venv --python 3.12
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000/api`

Docs interativas: `http://localhost:8000/docs`

## Executar Frontend

```powershell
cd frontend
npm install
npm.cmd run dev
```

Painel: `http://localhost:5173`

## Fluxo Operacional

1. A API cria dados iniciais de tanques, mangueiras, receita e operador.
2. O frontend chama `POST /api/operation/tick` periodicamente.
3. A engine liga a primária SV630B, reduz a pressão por tanque e libera a Roots WSU2001 somente abaixo da pressão segura da receita.
4. Cada leitura registra pressão real simulada, pressão esperada, óleo, perda de carga da mangueira e risco de colapso.
5. A API persiste leituras, ciclos, alarmes, eventos de rastreabilidade, manutenção e resultados what-if.

## Navegação

- Operação
- Histórico e Rastreabilidade
- Inteligência do Processo
- Relatórios
- Configurações

## Verificações

```powershell
cd frontend
npm.cmd run build
```

```powershell
cd backend
uv run python -m compileall app
```
