(* ===================================================================== *)
(*   TSEA V-TWIN - BANCADA IoT SENAI                                     *)
(*   CLP:  Altus XP325                                                   *)
(*   IP:   172.24.10.10:502 (Modbus TCP)                                 *)
(*   Data: 2026-07-28                                                    *)
(*   Ferramenta: MasterTool IEC / Toolbox XP325                          *)
(*                                                                      *)
(*   MAPA Modbus:                                                        *)
(*     Saidas  (coils 0-5)                                              *)
(*       Coil 0 = DO_Bomba1     Q0.0                                    *)
(*       Coil 1 = DO_Bomba2     Q0.1                                    *)
(*       Coil 2 = DO_Oleo       Q0.2                                    *)
(*       Coil 3 = DO_FarolVerde Q0.3                                    *)
(*       Coil 4 = DO_FarolAmar  Q0.4                                    *)
(*       Coil 5 = DO_FarolVerm  Q0.5                                    *)
(*     Entradas (discrete 0-5)                                          *)
(*       In 0  = DI_Emergencia I0.0                                     *)
(*       In 1  = DI_FB_Motor1  I0.1                                     *)
(*       In 2  = DI_FB_Motor2  I0.2                                     *)
(*       In 3  = DI_FB_Motor3  I0.3                                     *)
(*       In 4  = DI_Start      I0.4                                     *)
(*       In 5  = DI_Stop       I0.5                                     *)
(*     Status (coils 16-18)                                             *)
(*       Coil 16 = ST_CicloAtivo                                        *)
(*       Coil 17 = ST_Finalizado                                        *)
(*       Coil 18 = ST_EmergenciaAtiva                                   *)
(*     Registradores (holding 0-1)                                      *)
(*       HR 0   = ST_EtapaAtual                                         *)
(*       HR 1   = ST_CodigoAlarme                                       *)
(* ===================================================================== *)

PROGRAM TSEA_MAIN
VAR
    (* ENTRADAS (Ix.x) *)
    DI_Emergencia  : BOOL;
    DI_FB_Motor1   : BOOL;
    DI_FB_Motor2   : BOOL;
    DI_FB_Motor3   : BOOL;
    DI_Start       : BOOL;
    DI_Stop        : BOOL;

    (* SAIDAS (Qx.x) *)
    DO_Bomba1      : BOOL;
    DO_Bomba2      : BOOL;
    DO_Oleo        : BOOL;
    DO_FarolVerde  : BOOL;
    DO_FarolAmar   : BOOL;
    DO_FarolVerm   : BOOL;

    (* COMANDOS MODBUS (escritos pela IHM/Gateway) *)
    CMD_Cycle      : BOOL;
    CMD_Emergency  : BOOL;

    (* STATUS MODBUS (lidos pela IHM/Gerente) *)
    ST_CicloAtivo      : BOOL;
    ST_Finalizado      : BOOL;
    ST_EmergenciaAtiva : BOOL;
    ST_EtapaAtual      : INT;
    ST_CodigoAlarme    : INT;

    (* INTERNAS *)
    etapa          : INT := 0;
    ciclo_iniciado : BOOL := FALSE;
    alarme         : INT := 0;
    t_etapa        : TON;
END_VAR

(* 1. EMERGENCIA - prioridade maxima *)
IF DI_Emergencia OR CMD_Emergency OR DI_Stop THEN
    DO_Bomba1      := FALSE;
    DO_Bomba2      := FALSE;
    DO_Oleo        := FALSE;
    DO_FarolVerde  := FALSE;
    DO_FarolAmar   := FALSE;
    DO_FarolVerm   := TRUE;
    etapa          := -1;
    alarme         := 1;
    ciclo_iniciado := FALSE;
    t_etapa(IN := FALSE);
    GOTO PUBLICACAO_STATUS;
END_IF;

(* 2. INICIO DO CICLO *)
IF CMD_Cycle OR DI_Start THEN
    IF NOT ciclo_iniciado AND (etapa = 0) THEN
        ciclo_iniciado := TRUE;
        etapa          := 10;
        alarme         := 0;
    END_IF;
    CMD_Cycle := FALSE;
    DI_Start  := FALSE;
END_IF;

(* 3. SEQUENCIA *)
IF ciclo_iniciado THEN
    CASE etapa OF
        10:
            DO_Bomba1      := TRUE;
            DO_Bomba2      := FALSE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := FALSE;
            DO_FarolAmar   := TRUE;
            DO_FarolVerm   := FALSE;
            t_etapa(IN := TRUE, PT := T#5S);
            IF t_etapa.Q THEN
                t_etapa(IN := FALSE);
                etapa := 20;
            END_IF;

        20:
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

        30:
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

        40:
            DO_Bomba1      := FALSE;
            DO_Bomba2      := FALSE;
            DO_Oleo        := FALSE;
            DO_FarolVerde  := TRUE;
            DO_FarolAmar   := FALSE;
            DO_FarolVerm   := FALSE;
            ciclo_iniciado := FALSE;
            t_etapa(IN := FALSE);
    ELSE
        DO_Bomba1      := FALSE;
        DO_Bomba2      := FALSE;
        DO_Oleo        := FALSE;
        DO_FarolVerde  := TRUE;
        DO_FarolAmar   := FALSE;
        DO_FarolVerm   := FALSE;
        etapa          := 0;
        ciclo_iniciado := FALSE;
    END_CASE;
END_IF;

(* 4. STATUS *)
PUBLICACAO_STATUS:
ST_CicloAtivo      := ciclo_iniciado OR (etapa >= 10 AND etapa <= 39);
ST_Finalizado      := (etapa = 40);
ST_EmergenciaAtiva := (etapa = -1);
ST_EtapaAtual      := etapa;
ST_CodigoAlarme    := alarme;

END_PROGRAM
