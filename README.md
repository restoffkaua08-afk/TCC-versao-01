# TSEA V-Twin

<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:071019,45:0F4C5C,100:00A6A6&text=TSEA%20V-TWIN&fontColor=FFFFFF&fontSize=44&fontAlignY=38&animation=fadeIn&desc=G%C3%8AMEO%20DIGITAL%20PARA%20PROCESSOS%20INDUSTRIAIS%20DE%20V%C3%81CUO&descAlignY=59&descSize=15" alt="TSEA V-Twin"/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=2800&pause=900&color=2DD4BF&center=true&vCenter=true&width=900&lines=React+%2B+TypeScript+%2B+FastAPI;Simula%C3%A7%C3%A3o+e+supervis%C3%A3o+industrial;G%C3%AAmeo+Digital+%E2%80%A2+Alarmes+%E2%80%A2+Rastreabilidade;Projeto+TCC+em+evolu%C3%A7%C3%A3o" alt="Stack e propósito"/>

<br>

### Plataforma acadêmica para simulação, supervisão e análise de processos industriais de vácuo.

<br>

![Status](https://img.shields.io/badge/STATUS-EM%20CONSOLIDAÇÃO-00A6A6?style=for-the-badge&labelColor=071019)
![Type](https://img.shields.io/badge/PROJETO-TCC-2DD4BF?style=for-the-badge&labelColor=071019)
![Architecture](https://img.shields.io/badge/ARQUITETURA-FULL%20STACK-5EEAD4?style=for-the-badge&labelColor=071019)

</div>

<br>

# `> PROJECT.OVERVIEW`

O **TSEA V-Twin** é um protótipo de sistema industrial criado para representar e acompanhar o processo de vácuo em tanques e reguladores. A aplicação reúne supervisão operacional, simulações, alarmes, rastreabilidade, histórico, relatórios, manutenção e cenários de Gêmeo Digital.

Este repositório foi preservado como repositório principal por concentrar o histórico de desenvolvimento e a maior parte dos commits do projeto. Atualmente ele mantém versões anteriores em pastas separadas para preservar a evolução técnica enquanto a implementação definitiva é consolidada.

<br>

# `> CORE.TECH_STACK`

<div align="center">

<img src="https://skillicons.dev/icons?i=react,ts,python,fastapi,sqlite,vite,git,github,vscode&theme=dark" alt="React, TypeScript, Python, FastAPI, SQLite e Vite"/>

</div>

<br>

# `> SYSTEM.FEATURES`

- supervisão de ciclos de vácuo;
- acompanhamento de tanques, mangueiras e receitas;
- simulação de pressão e parâmetros operacionais;
- Gêmeo Digital com cenários demonstrativos;
- alarmes e recomendações;
- histórico e rastreabilidade;
- relatórios e manutenção;
- visualização de risco operacional;
- assistente contextual com fallback local;
- integração planejada com hardware físico.

<br>

# `> SYSTEM.ARCHITECTURE`

```text
Operador / Gestor
       │
       ▼
React + TypeScript
       │
       ▼
FastAPI / Serviços de domínio
       │
       ├── Simulação e Gêmeo Digital
       ├── Alarmes e manutenção
       ├── Rastreabilidade e relatórios
       └── Persistência SQLite
```

Na evolução física, o frontend não deve se comunicar diretamente com sensores ou controladores. A integração deve ocorrer por uma camada de gateway responsável por traduzir e validar os dados do hardware.

<br>

# `> VERSION.HISTORY`

| Diretório | Papel atual |
|---|---|
| `versao_3/` | versão mais recente preservada no repositório |
| `versao_2/` | versão anterior para comparação |
| `sistema_prototipo_fisico/` | base preparada para integração física |
| `Prototipo_IHM/` | protótipo separado da interface do operador |

Essas pastas permanecem temporariamente para preservar o histórico. A consolidação futura deverá escolher uma estrutura definitiva e migrar somente os recursos exclusivos de cada versão.

<br>

# `> PROJECT.STRUCTURE`

```text
TCC-versao-01/
├── versao_3/
│   ├── backend/
│   ├── frontend/
│   └── docs/
├── versao_2/
├── sistema_prototipo_fisico/
├── Prototipo_IHM/
├── .gitignore
└── README.md
```

<br>

# `> GETTING.STARTED`

## Pré-requisitos

- Python 3.12;
- Node.js e npm;
- PowerShell ou terminal equivalente.

Escolha a versão que será executada. Para a versão principal preservada:

```powershell
cd versao_3
```

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

<br>

# `> ENVIRONMENT.CONFIG`

Utilize os arquivos `.env.example` de cada aplicação como referência. Nunca publique chaves da OpenAI, credenciais, tokens ou endereços privados de equipamentos.

<br>

# `> QUALITY.ASSURANCE`

```powershell
cd frontend
npm run build
```

```powershell
cd backend
python -m compileall app
```

Além do build, valide os cenários operacionais, alarmes, persistência e comunicação entre frontend e API.

<br>

# `> SECURITY`

- segredos externos devem permanecer em arquivos locais;
- comandos físicos precisam de validação e limites seguros;
- o sistema acadêmico não substitui dispositivos certificados de segurança;
- integrações com hardware devem falhar em estado seguro;
- simulações devem ser identificadas claramente como simulações.

<br>

# `> PROJECT.ROADMAP`

- [ ] comparar `versao_3` com o repositório `prototipo-tsea`;
- [ ] migrar recursos exclusivos para uma estrutura definitiva;
- [ ] remover duplicações somente após validação;
- [ ] consolidar IHM, sistema gerencial e gateway;
- [ ] ampliar testes automatizados;
- [ ] adicionar capturas e diagrama final;
- [ ] preparar demonstração reproduzível.

<br>

# `> ENGINEERING.PRINCIPLES`

> **Em sistemas industriais, previsibilidade, rastreabilidade e falha segura são requisitos de engenharia.**

<br>

# `> PROJECT.STATUS`

## 🚧 Consolidação técnica em andamento

O histórico foi preservado intencionalmente. O repositório `prototipo-tsea` não deve ser removido até que uma comparação confirme a migração completa de seus recursos.

<br>

# `> DEVELOPER`

## Kauã Restoff

[![GitHub](https://img.shields.io/badge/GitHub-restoffkaua08--afk-181717?style=for-the-badge&logo=github)](https://github.com/restoffkaua08-afk)

<div align="center">

## `SIMULATE • TRACE • IMPROVE`

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:071019,45:0F4C5C,100:00A6A6" alt="Rodapé"/>

</div>
