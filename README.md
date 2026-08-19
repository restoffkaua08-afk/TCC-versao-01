<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:071A2B,50:004B76,100:00A7E1&text=TSEA%20V-Twin&fontColor=FFFFFF&fontSize=46&fontAlignY=38&animation=fadeIn&desc=Automa%C3%A7%C3%A3o%2C%20supervis%C3%A3o%20e%20rastreabilidade%20industrial&descAlignY=59&descSize=16" />

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=19&duration=2800&pause=900&color=00A7E1&center=true&vCenter=true&width=900&lines=Supervis%C3%A3o+industrial+em+tempo+real;Integra%C3%A7%C3%A3o+entre+software%2C+CLP+e+Node-RED;Rastreabilidade+e+controle+de+opera%C3%A7%C3%B5es;Projeto+integrador+desenvolvido+no+SENAI" />

<br>

Sistema integrado para automação, supervisão e rastreabilidade de operações industriais, conectando interfaces web, API, Node-RED e CLP.

<br><br>

![Status](https://img.shields.io/badge/STATUS-PROT%C3%93TIPO%20FUNCIONAL-00A7E1?style=for-the-badge&labelColor=071A2B)
![TCC](https://img.shields.io/badge/PROJETO-TCC%20SENAI-F7941D?style=for-the-badge&labelColor=071A2B)
![Arquitetura](https://img.shields.io/badge/ARQUITETURA-IOT%20INDUSTRIAL-00A7E1?style=for-the-badge&labelColor=071A2B)

</div>

<br>

# `> PROJECT.OVERVIEW`

## Automação e supervisão aplicadas a um problema industrial real

O **TSEA V-Twin** é um protótipo desenvolvido como Trabalho de Conclusão de Curso no Técnico em Desenvolvimento de Sistemas do SENAI.

A proposta foi representar e integrar um processo de vácuo industrial por meio de software e automação. O sistema conecta uma **IHM do operador**, um **painel gerencial**, um **Gateway em FastAPI**, **Node-RED**, comunicação **Modbus TCP** e um **CLP Altus XP325**.

A solução permite iniciar e acompanhar operações, visualizar estados do processo, registrar informações, consultar histórico, acompanhar indicadores e demonstrar fisicamente a sequência de controle em uma bancada IoT do SENAI.

> Este repositório apresenta uma solução acadêmica funcional baseada em um cenário industrial real. Não representa um sistema oficial ou produto comercial da TSEA Energia.

<br>

# `> CORE.TECH_STACK`

<div align="center">

## Tecnologias principais

### Linguagens

<img src="https://skillicons.dev/icons?i=python,ts,js,html,css&theme=dark" />

<br><br>

### Front-end

<img src="https://skillicons.dev/icons?i=react,vite&theme=dark" />

<br><br>

### Desenvolvimento e versionamento

<img src="https://skillicons.dev/icons?i=git,github,vscode,powershell&theme=dark" />

<br><br>

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Node-RED](https://img.shields.io/badge/Node--RED-8F0000?style=for-the-badge&logo=nodered&logoColor=white)
![Modbus TCP](https://img.shields.io/badge/Modbus-TCP-00599C?style=for-the-badge)
![PLC](https://img.shields.io/badge/PLC-Altus%20XP325-F7941D?style=for-the-badge)
![Structured Text](https://img.shields.io/badge/PLC-Structured%20Text-1B4F72?style=for-the-badge)

</div>

<br>

# `> PROJECT.PREVIEW`

<div align="center">

## Demonstração do sistema

### Operação pela IHM

<img width="100%" src="./.github/assets/demo-ihm.gif" alt="Demonstração da operação no TSEA V-Twin" />

### IHM do operador

<img width="100%" src="./.github/assets/ihm-operador.png" alt="Interface da IHM do operador" />

### Supervisão e rastreabilidade

<img width="100%" src="./.github/assets/sistema-gerente.png" alt="Painel de supervisão e rastreabilidade" />

</div>

<br>

# `> SYSTEM.FEATURES`

## Funcionalidades principais

- preparação e início de operações pela IHM;
- acompanhamento das etapas e estados do processo;
- rotina de emergência com prioridade sobre o ciclo;
- supervisão por painel gerencial;
- histórico e rastreabilidade das operações;
- visualização de indicadores e gráficos;
- gerenciamento de parâmetros e receitas;
- comunicação entre interfaces e Gateway por HTTP/JSON e WebSocket;
- integração entre Gateway e Node-RED;
- comunicação Modbus TCP com o CLP;
- sequência de controle implementada em Structured Text;
- operação simulada para desenvolvimento sem a bancada física.

<br>

# `> SYSTEM.ARCHITECTURE`

## Arquitetura da solução

```mermaid
flowchart LR
    IHM[IHM do Operador] --> API[Gateway FastAPI]
    GER[Sistema Gerente] --> API
    API --> NR[Node-RED]
    NR --> PLC[CLP Altus XP325]
    PLC --> BANCADA[Bancada IoT]
    BANCADA --> PLC
    PLC --> API
```

### Fluxo de uma operação

1. O operador inicia uma operação pela IHM.
2. A interface envia o comando ao Gateway FastAPI.
3. O Gateway registra o estado e encaminha a integração ao Node-RED.
4. A camada de automação se comunica com o CLP por Modbus TCP.
5. O CLP executa a sequência de controle programada.
6. Motores e sinalizadores representam os atuadores industriais na bancada.
7. Os estados retornam ao sistema para supervisão e rastreabilidade.

<br>

# `> PLC.CONTROL`

## Sequência do CLP

A lógica principal está em [`plc/TSEA_MAIN.st`](./plc/TSEA_MAIN.st).

| Etapa | Ação principal |
| --- | --- |
| `0` | sistema pronto |
| `10` | acionamento do Motor 1 |
| `20` | acionamento dos Motores 1 e 2 |
| `30` | acionamento dos Motores 1, 2 e sistema de óleo |
| `40` | finalização e sinalização verde |
| `-1` | emergência e desligamento das saídas de processo |

A rotina de emergência é avaliada antes da sequência normal e interrompe o ciclo quando acionada.

<br>

# `> PROJECT.STRUCTURE`

```text
tsea-v-twin/
├── gateway_fisico/
│   └── backend/
├── ihm_operador/
│   └── frontend/
├── sistema_gerente/
│   └── frontend/
├── node_red/
├── plc/
│   └── TSEA_MAIN.st
├── scripts/
├── docs/
├── .github/
│   └── assets/
└── README.md
```

<br>

# `> GETTING.STARTED`

## Pré-requisitos

- Node.js e npm
- Python 3
- PowerShell
- Node-RED para a integração de automação
- acesso ao CLP apenas para a validação física

## Instalação

```powershell
git clone https://github.com/restoffkaua08-afk/tsea-v-twin.git
cd tsea-v-twin

cd gateway_fisico/backend
python -m venv .venv_gateway
.\.venv_gateway\Scripts\Activate.ps1
pip install -r requirements.txt

cd ../../ihm_operador/frontend
npm install

cd ../../sistema_gerente/frontend
npm install
```

## Execução

Na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\abrir_tsea_completo.ps1
```

Para iniciar também a integração com Node-RED:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\iniciar_node_red.ps1
```

| Serviço | Endereço |
| --- | --- |
| Sistema gerente | `http://127.0.0.1:5173` |
| IHM do operador | `http://127.0.0.1:5178` |
| Gateway/API | `http://127.0.0.1:8020` |
| Node-RED | `http://127.0.0.1:1880` |

<br>

# `> ACADEMIC.CONTEXT`

## Trabalho de Conclusão de Curso — SENAI

A validação física foi realizada em uma bancada IoT do SENAI equipada com um **CLP Altus XP325**, três motores elétricos e sinalizadores representando os atuadores do processo.

O projeto reuniu conhecimentos de desenvolvimento web, APIs, redes, comunicação entre sistemas, automação industrial, programação de CLP e integração com hardware.

<div align="center">

[![Publicação no LinkedIn](https://img.shields.io/badge/VER%20APRESENTA%C3%87%C3%83O%20DO%20PROJETO-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/posts/kau%C3%A3-restoff-2821163a0_senai-desenvolvimentodesistemas-tecnologia-ugcPost-7490098613986004992-9BbY/)

</div>

<br>

# `> DOCUMENTATION`

A documentação complementar está organizada em [`docs/`](./docs/):

- [`RELATORIO_TECNICO_TSEA.md`](./docs/RELATORIO_TECNICO_TSEA.md) — visão técnica consolidada do sistema;
- [`PLC_XP325.md`](./docs/PLC_XP325.md) — integração, mapa de I/O e operação do CLP;
- [`GRAPH_SPECIFICATION.md`](./docs/GRAPH_SPECIFICATION.md) — especificação dos gráficos e indicadores.

<br>

# `> PROJECT.STATUS`

**TCC concluído — protótipo funcional.**

As interfaces, o Gateway, a integração com Node-RED, a lógica do CLP e a demonstração em bancada física foram implementadas e utilizadas na apresentação acadêmica.

<br>

# `> DEVELOPER`

<div align="center">

## Kauã Restoff

Desenvolvedor de software com interesse em desenvolvimento web, engenharia de software, automação e integração entre software e hardware.

[![GitHub](https://img.shields.io/badge/GitHub-restoffkaua08--afk-181717?style=for-the-badge&logo=github)](https://github.com/restoffkaua08-afk)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Kau%C3%A3%20Restoff-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/kau%C3%A3-restoff-2821163a0)

<br><br>

Desenvolvido como Trabalho de Conclusão do Curso Técnico em Desenvolvimento de Sistemas no SENAI.

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:00A7E1,50:004B76,100:071A2B&animation=fadeIn" />

</div>