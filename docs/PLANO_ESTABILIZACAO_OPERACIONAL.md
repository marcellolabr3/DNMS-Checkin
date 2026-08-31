# Plano de Estabilizacao Operacional

Este arquivo consolida os problemas observados no teste pratico e as correcoes propostas. Deve ser mantido curto e atualizado por substituicao conforme cada frente for resolvida.

## Problemas Relatados

1. Impressao instavel no notebook
   - No PC, quando a Brother esta conectada, check-ins feitos pelo celular imprimem.
   - No notebook, a autoimpressao nao acontece.
   - A impressao funciona quando feita pela tela de reimpressao ou por fluxo direto que envia a etiqueta ao servico local.
   - A tela de monitoramento passou a mostrar Brother online mesmo desligada.
   - A tela de status ficou poluida com informacoes pouco uteis.

2. Cadastro de responsaveis pelo SADMIN
   - Muitos responsaveis foram cadastrados diretamente pelo SADMIN.
   - Precisa validar se o email de primeiro acesso chega, se o link abre corretamente e se o responsavel consegue acessar depois.
   - Precisa existir caminho operacional para reenviar acesso quando necessario.

3. Check-ins ativos antigos
   - Uma crianca estava com check-in ativo de dia anterior.
   - Isso bloqueou ou confundiu o fluxo atual de check-in.
   - Precisa haver alerta e limpeza operacional antes do evento.

4. Log sem resumo operacional
   - O log mostra criancas com check-in, mas nao apresenta uma visao organica do evento.
   - Falta resumo geral por classe/sala, total do dia, pendentes de impressao e check-outs.

## Solucoes Propostas

1. Impressao
   - Corrigir deteccao online/offline da Brother, priorizando o estado real reportado pelo Windows.
   - Mostrar status operacional simples: servico local, Brother, autoimpressao do celular, fila local e ultimo erro.
   - Exigir `DATABASE_URL` ou Service Role no servico local para autoimprimir check-ins feitos em outro dispositivo.
   - Manter reimpressao como fallback.
   - Adicionar teste de impressao e diagnostico de configuracao do notebook.

2. Cadastro
   - Implementado no app: cadastro de responsavel pelo SADMIN/Admin envia email de primeiro acesso via recuperacao de senha.
   - Implementado no app: acao administrativa "Reenviar acesso" para responsavel cadastrado, com registro em `audit_logs`.
   - Validado por testes automatizados; confirmacao real de recebimento de email/login em producao ainda exige teste manual com conta real.
   - Indicador de acesso confirmado nao foi adicionado porque o frontend anon nao deve consultar `auth.users.email_confirmed_at`.

3. Check-in
   - Implementado no dashboard: alerta para check-ins ativos de dias anteriores.
   - Implementado no dashboard: Admin/SADMIN pode encerrar check-ins antigos em lote com confirmacao e auditoria `stale_checkins_closed`; equipe apenas visualiza.
   - Tela de alunos ja mostra check-in ativo com botao "Check-in realizado" desabilitado e checkout para operador autorizado.

4. Resumo do evento
   - Implementado no dashboard: resumo do dia com total geral, criancas unicas, ativos, check-outs e pendentes de impressao.
   - Implementado no Log: relatorio "Resumo do evento" por periodo/turma, com agrupamento por turma e por sala.
   - Implementada exportacao CSV compativel com Excel e compartilhamento por WhatsApp com resumo detalhado; a Assiduidade tambem exporta/compartilha totais antes da lista nominal.

## Ordem Recomendada

1. Corrigir impressao e monitoramento.
2. Cadastro SADMIN e reenvio de acesso concluido no app; falta validacao manual em producao com conta real.
3. Saneamento/alerta de check-ins ativos antigos concluido no app.
4. Painel/resumo do evento concluido no app.
