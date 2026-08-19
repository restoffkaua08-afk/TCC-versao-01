# Documentação — TSEA V-Twin

Esta pasta reúne a documentação técnica complementar do projeto.

## Documentos principais

### [Relatório Técnico Consolidado](./RELATORIO_TECNICO_TSEA.md)

Documento principal do projeto. Reúne:

- contexto e objetivo;
- arquitetura da solução;
- componentes de software;
- integração com Node-RED e CLP;
- fluxo de operação;
- mapa de I/O;
- validações realizadas;
- decisões técnicas;
- limitações e possibilidades de evolução.

### [Integração com CLP Altus XP325](./PLC_XP325.md)

Referência para a bancada IoT utilizada na validação física:

- entradas e saídas;
- status Modbus;
- máquina de estados;
- tratamento de emergência;
- orientação para importação e teste da lógica em Structured Text.

A implementação do CLP permanece em [`../plc/TSEA_MAIN.st`](../plc/TSEA_MAIN.st).

## Documentação complementar

Arquivos de especificação específicos podem permanecer nesta pasta quando forem úteis para manutenção ou entendimento de uma funcionalidade do sistema. O relatório consolidado deve ser usado como ponto de partida para compreender o projeto.

Para uma visão rápida, instruções de execução e apresentação do sistema, consulte o [`README.md`](../README.md) na raiz do repositório.
