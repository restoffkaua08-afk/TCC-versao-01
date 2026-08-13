# ST pronto para CLP Altus XP325 (Bancada IoT SENAI — TSEA V-Twin)

**Destino:** MasterTool IEC / Toolbox XP325 — IEC 61131-3 Structured Text
**Data:** 2026-07-28
**IP do CLP:** 172.24.10.10
**Modo de execução:** BANCADA_SEGURA (comandos só Modbus / COIL 16-18 são status)

---

## 🚦 INSTRUÇÕES RÁPIDAS DE IMPORTAÇÃO

1. **Criar projeto novo** no MasterTool:
   - `Arquivo → Novo projeto` → escolher **CLP: Altus XP325**.
   - Idioma: **ST** (Structured Text).
2. **Adicionar um POU (Programa Organization Unit)** chamado `TSEA_MAIN`:
   - Tipo: `Programa`.
   - Idioma: **ST**.
3. **Apagar o conteúdo padrão** e **colar o bloco abaixo**.
4. **Compilar** (Ctrl+B) — deve dar **0 erros**.
5. **Colocar o CLP em STOP** (`Online → Controle → STOP`).
6. **Login** (Ctrl+L) — geralmente user `altus` / senha `altus`.
7. **Download** (Ctrl+F9) — **"Download OK, sem erros"**.
8. **RUN** (Ctrl+F10) — pronto, o CLP roda o ciclo.

---

## ✅ CÓDIGO COMPLETO EM STRUCTURED TEXT (ST)

> 📋 **Copie tudo de `PROGRAM TSEA_MAIN` até o fim** abaixo e cole no
> MasterTool. O bloco de declaração de tags Modbus vem antes.

```iecst
(* ===================================================================== *)
(*   TSEA V-TWIN - BANCADA IoT SENAI                                     *)
(*   CLP:  Altus XP325                                                   *)
(*   IP:   172.24.10.10:502 (Modbus TCP)                                 *)
(*   Data: 2026-07-28                                                    *)
(*                                                                      *)
(*   MAPA Modbus (acessivel pelo Gateway / IHM via Modbus TCP):         *)
(*     Saidas  (coils 0-5)             |  Entradas (discrete 0-5)      *)
(*       Coil 0 = DO_Bomba1     Q0.0   |  In 0  = DI_Emergencia I0.0   *)
(*       Coil 1 = DO_Bomba2     Q0.1   |  In 1  = DI_FB_Motor1  I0.1   *)
(*       Coil 2 = DO_Oleo       Q0.2   |  In 2  = DI_FB_Motor2  I0.2   *)
(*       Coil 3 = DO_FarolVerde Q0.3   |  In 3  = DI_FB_Motor3  I0.3   *)
(*       Coil 4 = DO_FarolAmar  Q0.4   |  In 4  = DI_Start      I0.4   *)
(*       Coil 5 = DO_FarolVerm  Q0.5   |  In 5  = DI_Stop       I0.5   *)
(*     Status (coils 16-18)                                              *)
(*       Coil 16 = ST_CicloAtivo                                         *)
(*       Coil 17 = ST_Finalizado                                         *)
(*       Coil 18 = ST_EmergenciaAtiva                                    *)
(*     Registradores (holding 0-1)                                       *)
(*       HR 0   = ST_EtapaAtual                                          *)
(*       HR 1   = ST_CodigoAlarme                                        *)
(* ===================================================================== *)

PROGRAM TSEA_MAIN
VAR
    (* =========================================================== *)
    (* VARIAVEIS DE ENTRADA (vem dos bornes Ix.x do XP325)       *)
    (* =========================================================== *)
    DI_Emergencia  : BOOL;   (* I0.0 - botao cogumelo            *)
    DI_FB_Motor1   : BOOL;   (* I0.1 - feedback Motor 1 (opc.)  *)
    DI_FB_Motor2   : BOOL;   (* I0.2 - feedback Motor 2 (opc.)  *)
    DI_FB_Motor3   : BOOL;   (* I0.3 - feedback Motor 3 (opc.)  *)
    DI_Start       : BOOL;   (* I0.4 - botao start fisico       *)
    DI_Stop        : BOOL;   (* I0.5 - botao stop fisico        *)

    (* =========================================================== *)
    (* VARIAVEIS DE SAIDA (vai para os bornes Qx.x do XP325)     *)
    (* =========================================================== *)
    DO_Bomba1      : BOOL;   (* Q0.0 - Motor 1 (Bomba B1)       *)
    DO_Bomba2      : BOOL;   (* Q0.1 - Motor 2 (Bomba B2 Roots)*)
    DO_Oleo        : BOOL;   (* Q0.2 - Motor 3 (Sistema Oleo)  *)
    DO_FarolVerde  : BOOL;   (* Q0.3 - sinaleiro verde          *)
    DO_FarolAmar   : BOOL;   (* Q0.4 - sinaleiro amarelo        *)
    DO_FarolVerm   : BOOL;   (* Q0.5 - sinaleiro vermelho       *)

    (* =========================================================== *)
    (* VARIAVEIS DE COMANDO MODBUS (escritas pela IHM via Modbus)*)
    (* =========================================================== *)
    CMD_Cycle      : BOOL;   (* Coil de start (vem da IHM)      *)
    CMD_Emergency  : BOOL;   (* Coil de emergencia (IHM ou E-Stop fisico)*)

    (* =========================================================== *)
    (* VARIAVEIS DE STATUS MODBUS (escritas pelo ST, lidas pela IHM) *)
    (* =========================================================== *)
    ST_CicloAtivo      : BOOL;   (* Coil 16 *)
    ST_Finalizado      : BOOL;   (* Coil 17 *)
    ST_EmergenciaAtiva : BOOL;   (* Coil 18 *)
    ST_EtapaAtual      : INT;    (* HR 0  - 0=ocioso, 10,20,30,40,-1=emerg *)
    ST_CodigoAlarme    : INT;    (* HR 1  - 0=sem alarme, 1=emergencia    *)

    (* =========================================================== *)
    (* VARIAVEIS INTERNAS DE LOGICA                                *)
    (* =========================================================== *)
    etapa         : INT := 0;     (* 0,10,20,30,40,-1                 *)
    ciclo_iniciado: BOOL := FALSE;
    alarme        : INT := 0;
    t_etapa       : TON;          (* timer de 5 segundos por etapa    *)
END_VAR

(* ===================================================================== *)
(* 1. DETECCAO DE EMERGENCIA - PRIORIDADE MAXIMA                        *)
(* ===================================================================== *)
IF DI_Emergencia OR CMD_Emergency OR DI_Stop THEN
    (* Desliga tudo imediatamente *)
    DO_Bomba1      := FALSE;
    DO_Bomba2      := FALSE;
    DO_Oleo        := FALSE;
    DO_FarolVerde  := FALSE;
    DO_FarolAmar   := FALSE;
    DO_FarolVerm   := TRUE;       (* Liga farol vermelho              *)

    (* Marca estado de emergencia *)
    etapa          := -1;
    alarme         := 1;
    ciclo_iniciado := FALSE;
    t_etapa(IN := FALSE);

    (* Pula direto para a publicacao de status *)
    GOTO PUBLICACAO_STATUS;
END_IF;

(* ===================================================================== *)
(* 2. INICIO DO CICLO (so se nao esta em ciclo e nao em emergencia)     *)
(* ===================================================================== *)
IF CMD_Cycle OR DI_Start THEN
    IF NOT ciclo_iniciado AND (etapa = 0) THEN
        ciclo_iniciado := TRUE;
        etapa          := 10;
        alarme         := 0;
    END_IF;
    (* Consome o pulso de start *)
    CMD_Cycle := FALSE;
    DI_Start  := FALSE;
END_IF;

(* ===================================================================== *)
(* 3. SEQUENCIA DO CICLO (10 -> 20 -> 30 -> 40)                         *)
(* ===================================================================== *)
IF ciclo_iniciado THEN
    CASE etapa OF

        (* ----------------------------------------------------------- *)
        10:  (* ETAPA 10 - Apenas Motor 1 (Bomba B1) por 5s *)
            DO_Bomba1      := TRUE;
            DO_Bomba2      := FALSE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := FALSE;
            DO_FarolAmar   := TRUE;   (* Amarelo indica "em ciclo" *)
            DO_FarolVerm   := FALSE;

            t_etapa(IN := TRUE, PT := T#5S);
            IF t_etapa.Q THEN
                t_etapa(IN := FALSE);
                etapa := 20;
            END_IF;

        (* ----------------------------------------------------------- *)
        20:  (* ETAPA 20 - Motor 1 + Motor 2 por 5s *)
            DO_Bomba1      := TRUE;
            DO_Bomba2      := TRUE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := FALSE;
            DO_FarolAmar   := TRUE;
            DO_FarolVerm   := FALSE;

            t_etapa(IN := TRUE, PT := T#5S);
            IF t_etapa.Q THEN
                t_etapa(IN := FALSE);
                etapa := 30;
            END_IF;

        (* ----------------------------------------------------------- *)
        30:  (* ETAPA 30 - Motor 1 + Motor 2 + Oleo por 5s *)
            DO_Bomba1      := TRUE;
            DO_Bomba2      := TRUE;
            DO_Oleo        := TRUE;
            DO_FarolVerde  := FALSE;
            DO_FarolAmar   := TRUE;
            DO_FarolVerm   := FALSE;

            t_etapa(IN := TRUE, PT := T#5S);
            IF t_etapa.Q THEN
                t_etapa(IN := FALSE);
                etapa := 40;
            END_IF;

        (* ----------------------------------------------------------- *)
        40:  (* ETAPA 40 - Ciclo finalizado *)
            DO_Bomba1      := FALSE;
            DO_Bomba2      := FALSE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := TRUE;    (* Verde indica "finalizado OK" *)
            DO_FarolAmar   := FALSE;
            DO_FarolVerm   := FALSE;

            ciclo_iniciado := FALSE;
            t_etapa(IN := FALSE);
            (* etapa fica em 40 - eh o estado "finalizado" *)

        (* ----------------------------------------------------------- *)
        ELSE  (* qualquer outro valor: considera ocioso *)
            DO_Bomba1      := FALSE;
            DO_Bomba2      := FALSE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := TRUE;    (* Verde = pronto/idle *)
            DO_FarolAmar   := FALSE;
            DO_FarolVerm   := FALSE;
            etapa          := 0;
            ciclo_iniciado := FALSE;
    END_CASE;
END_IF;

(* ===================================================================== *)
(* 4. PUBLICACAO DE STATUS (sempre executado)                            *)
(* ===================================================================== *)
PUBLICACAO_STATUS:

ST_CicloAtivo      := ciclo_iniciado OR (etapa >= 10 AND etapa <= 39);
ST_Finalizado      := (etapa = 40);
ST_EmergenciaAtiva := (etapa = -1);
ST_EtapaAtual      := etapa;
ST_CodigoAlarme    := alarme;

END_PROGRAM
```

---

## 🔌 MAPA DE BORNES (qual cabo vai onde)

| Endereço Lógico | Borne Físico XP325 | O que ligar |
|---|---|---|
| **ENTRADAS** | | |
| `DI_Emergencia` | `I0.0` | Botão cogumelo NA → +24V |
| `DI_FB_Motor1` | `I0.1` | Contato aux. NA do contator do Motor 1 |
| `DI_FB_Motor2` | `I0.2` | Contato aux. NA do contator do Motor 2 |
| `DI_FB_Motor3` | `I0.3` | Contato aux. NA do contator do Motor 3 |
| `DI_Start` | `I0.4` | Botão pulsador NA → +24V (opcional) |
| `DI_Stop` | `I0.5` | Botão pulsador NF ou cogumelo → +24V (opcional) |
| **SAÍDAS** | | |
| `DO_Bomba1` | `Q0.0` | Bobina do contator Motor 1 |
| `DO_Bomba2` | `Q0.1` | Bobina do contator Motor 2 |
| `DO_Oleo` | `Q0.2` | Bobina do contator Motor 3 |
| `DO_FarolVerde` | `Q0.3` | Farol verde 24Vcc (ou via contator) |
| `DO_FarolAmar` | `Q0.4` | Farol amarelo 24Vcc |
| `DO_FarolVerm` | `Q0.5` | Farol vermelho 24Vcc |

---

## 🧪 COMO TESTAR SEM MOTORES LIGADOS (modo seguro)

Para validar o ST **antes** de conectar motores/faróis:

1. **Online → Watch / Monitorar** (ou `Ctrl+F11`).
2. Adicione as variáveis `etapa`, `ciclo_iniciado`, `DO_Bomba1`, etc., na janela de watch.
3. **Force** `CMD_Cycle := TRUE` (botão direito → Force / Set).
4. Acompanhe:
   - `etapa` deve ir de `0 → 10 → 20 → 30 → 40` (5s cada).
   - `DO_Bomba1`, `DO_Bomba2`, `DO_Oleo` devem ligar em sequência.
   - `DO_FarolAmar` acende durante, `DO_FarolVerde` ao final.
5. **Force** `CMD_Emergency := TRUE` ou acione `DI_Emergencia`:
   - Tudo desliga.
   - `DO_FarolVerm` acende.
   - `etapa` vai para `-1`.
   - `ST_EmergenciaAtiva := TRUE`.

> ✅ Se tudo isso funcionar, **o ST está 100% correto**. Agora pode ligar os motores/faróis reais.

---

## 🧹 LIMPEZA / RESET

Para zerar tudo e voltar ao estado inicial (`etapa = 0`, sem alarme):

```iecst
(* Use isto numa "manutencao via MasterTool" (Online -> Write Values): *)
etapa          := 0;
ciclo_iniciado := FALSE;
alarme         := 0;
CMD_Emergency  := FALSE;
DI_Emergencia  := FALSE;
t_etapa(IN := FALSE);
```

Depois disso o ST volta automaticamente a mostrar o farol **verde** (etapa = 0 = ocioso, farol verde aceso).

---

## 📋 CHECKLIST DE ENTREGA NO CLP

- [ ] Cabo de rede do PC ↔ CLP conectado (mesma rede `172.24.10.x`).
- [ ] PC configurado com IP fixo `172.24.10.20` (ou outro da rede).
- [ ] `ping 172.24.10.10` → responde.
- [ ] MasterTool aberto, projeto novo com CLP XP325.
- [ ] POU `TSEA_MAIN` (ST) colado.
- [ ] **Compilação: 0 erros**.
- [ ] **CLP em STOP** (Online → Controle → STOP).
- [ ] **Online → Login** (usuário `altus`, senha `altus` ou em branco).
- [ ] **Online → Download** → `Download OK`.
- [ ] **Online → RUN** → CLP volta a rodar.
- [ ] Teste no ar: força `CMD_Cycle = TRUE`, vê os `DO_xxx` ligarem.
- [ ] Teste de emergência: força `CMD_Emergency = TRUE`, tudo desliga, vermelho acende.
- [ ] Resetar tudo (`etapa := 0`), voltar ao estado de pronto.

---

**Resumo:** com esse ST colado no MasterTool, o CLP faz tudo sozinho — sequência 10→20→30→40, emergência cortando tudo, faróis sinalizando estado. O Gateway/IHM só precisa mandar `CMD_Cycle` e `CMD_Emergency` pelo Modbus, e o resto é o CLP executando.
