Você está no repositório Demonstracao_Tsea.

Problemas atuais:
1. Na IHM, ao clicar em INICIAR, aparece:
   "Nenhum tanque/regulador real cadastrado no gerente."
   Corrigir para a operação iniciar corretamente quando houver receita, mangueira e quantidade de tanques informada na IHM. Não exigir cadastro individual de tanque se a lógica do protótipo físico não precisar disso.

2. No sistema do gerente, em Rastreabilidade > Indicadores e Gráficos, ao gerar no Google Planilhas, aparece Internal Server Error ou Failed to fetch.
   Corrigir a rota /api/google-sheets/generate-chart, o proxy do Vite e o tratamento de erro para gerar a planilha corretamente.

3. Não quebrar:
   - Gateway/API em http://127.0.0.1:8020
   - IHM em http://127.0.0.1:5178
   - Gerente em http://127.0.0.1:5173
   - Login OAuth Google já configurado

Tarefas obrigatórias:
- Procurar a causa real no backend antes de alterar frontend.
- Rodar build do gerente.
- Rodar build da IHM.
- Rodar py_compile no backend.
- Testar endpoints:
  GET  /api/state
  POST /api/operation/start
  POST /api/google-sheets/generate-chart
- Fazer alterações mínimas e seguras.
- Explicar no final quais arquivos foram alterados.
