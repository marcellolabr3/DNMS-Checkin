# Central de dados do Log

O seletor **Operação** concentra os quatro relatórios existentes, responsáveis e filhos, os cadastros de crianças (incluindo previsão anual de troca de classe), a consulta ao banco e os backups. Não há uma seção independente de Extração. A aba Famílias oferece somente o atalho **Consultar no Log**, que mantém a busca digitada e abre o relatório; todos os downloads são feitos no Log.

- Equipe mantém os relatórios e as permissões anteriores, incluindo responsáveis e filhos. Esse relatório preserva contatos, quantidade e nomes dos filhos vinculados; oferece CSV, Excel e JSON, busca por nome/email/telefone e consulta de todos os responsáveis quando a busca está vazia.
- Admin/sadmin pode extrair os registros autorizados pelas políticas RLS existentes. O catálogo mostra as tabelas disponíveis ao usuário. Não há limite de mil linhas: cada consulta usa uma RPC que agrega os resultados completos em um único snapshot. Se a consulta exceder recursos do servidor ou falhar, nenhum arquivo é oferecido como concluído.
- Somente sadmin pode gerar backup global ou específico, pois ambos incluem contas de autenticação. A autorização é conferida novamente no banco, usando `auth.uid()` e o e-mail da conta em `auth.users`.

## Consulta e formatos

Em **Dados do banco**, o controle recolhido **Combinar critérios por campo** permite cruzar igualdade, busca textual, valores vazios/preenchidos e listas separadas por vírgula. Todos os critérios são aplicados em conjunto com busca, turma, evento e período. Para delimitar cadastros, use `id`, `student_id` ou `guardian_id`, conforme a tabela. Mudar a tabela ou a operação limpa esses critérios; backups não usam filtros que descartem registros.

Se a sessão mudar durante a leitura do banco ou a geração do backup, a operação é cancelada antes do download. A exportação Excel, incluindo os cadastros de crianças, também verifica a sessão e as permissões após carregar sua biblioteca. Respostas atrasadas de relatórios e catálogo não são aplicadas ao estado de outro usuário ou após encerrar a sessão.

Em **Dados do banco**, escolha tabela, campos e busca. Combine evento e turma quando houver esses relacionamentos; escolha qual coluna de data será usada pelo período De/Até. Sem coluna de data selecionada, o período não restringe os registros. A prévia mostra até 100 registros; a exportação inclui todos os resultados filtrados. CSV protege células que poderiam executar fórmulas; JSON conserva valores e objetos; Excel usa o mecanismo XLSX existente. Relatórios também oferecem os três formatos, preservando seu conteúdo e resumo.

## Backup de recuperação

Backup é sempre JSON, sem filtros de período, campos ou eventos. O global contém todas as tabelas `public`, `auth.users`, `auth.identities`, `auth.mfa_factors`, inventário de buckets/objetos e o conteúdo binário de todos os arquivos do Storage. O específico inclui as tabelas escolhidas e tabelas relacionadas completas, além das contas e arquivos necessários para recuperação. Dependências lógicas de check-ins são incluídas mesmo no schema legado sem todas as FKs. Por isso o backup específico pode ser maior do que a seleção inicial.

Os dados são lidos em um snapshot SQL consistente. Após baixar todos os arquivos, uma nova leitura deve ser idêntica à primeira; mudança, erro, tamanho divergente ou arquivo inacessível cancela a operação. O arquivo final tem SHA-256 sobre o conteúdo canônico; cada arquivo binário também tem seu próprio hash. Os backups contêm dados pessoais e hashes de senhas/MFA: guarde-os em local privado e protegido, fora do Git e de pastas publicadas. SHA-256 detecta corrupção, mas não criptografa nem autentica um arquivo contra substituição maliciosa.

Este é um backup dos **dados da aplicação**, não uma imagem da infraestrutura. Não inclui sessões/tokens transitórios, configurações do painel Supabase, provedores externos de autenticação, segredos de infraestrutura ou código-fonte. Código e schema são mantidos no Git; configurações de plataforma precisam de sua rotina administrativa própria. Nunca trate CSV/Excel ou JSON de consulta como arquivo de recuperação.

## Restauração administrativa

Use Node.js 20+ e `npm ci` no mesmo checkout/schema do backup. A restauração é permitida somente no projeto de origem; não altera URLs de fotos para outro projeto. Pare os clientes e o serviço de impressão durante uma restauração real para evitar concorrência e reprocessamento de jobs abertos.

1. Confira o arquivo, sem conectar ao banco:
   `node scripts/restore-log-backup.cjs backup.json --verify-only`
2. Defina `DATABASE_URL` (conexão Postgres administrativa), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente do terminal administrativo. Nunca coloque essas variáveis no frontend ou em arquivo versionado.
3. Execute a simulação:
   `node scripts/restore-log-backup.cjs backup.json`
4. Depois de revisar o resultado, aplique:
   `node scripts/restore-log-backup.cjs backup.json --apply`

Sem `--apply`, alterações no banco sempre sofrem rollback e nenhum arquivo é enviado ao Storage. A ferramenta verifica checksum, inventário, tipos/colunas, chaves primárias e relacionamentos. Reinsere/atualiza registros com IDs originais dentro de uma transação e relê cada valor para comparação. Triggers de recálculo/auditoria/impressão não são executados durante a recuperação. Um erro causa rollback dos dados do banco. Registros criados depois do backup são preservados: esta é uma recuperação por mesclagem, não uma exclusão do estado posterior.

Arquivos existentes com conteúdo diferente causam interrupção, sem sobrescrita. Arquivos ausentes são recuperados pela API oficial do Storage e conferidos por hash; não se escrevem metadados diretamente em `storage.objects`. Se o banco falhar depois de um upload, os arquivos adicionados podem permanecer no Storage; repetir a operação é seguro, pois conteúdos iguais são reconhecidos. A ferramenta não exclui arquivos ou registros novos. O schema deve estar instalado antes de recuperar dados; divergência de schema interrompe a operação.

## Instalação e verificação

Aplicar `supabase/patch_log_data_center.sql` no banco antes da publicação. O patch só cria RPCs, define seus acessos e atualiza o cache de schema PostgREST; não altera tabelas, dados ou RLS existentes.

`node scripts/validate-log-backend.cjs` usa `DATABASE_URL` para testar permissões negativas, extração, snapshot global/específico, dependências e restauração. Toda a execução fica em uma transação com rollback, inclusive a instalação temporária do patch. Não imprime dados pessoais nem salva snapshots em disco.

Testes de interface: `npm test -- tests/log-center.spec.js tests/checkin.spec.js tests/service-worker.spec.js`. Use `PLAYWRIGHT_PORT` quando a porta padrão 4173 estiver ocupada por outro checkout. A publicação precisa servir `app.js?v=20261108c`, `log-center.js?v=20261108c` e `checkin-cache-v200`.

Para executar a suíte contra os arquivos publicados, defina `PLAYWRIGHT_BASE_URL=https://dnms-checkin.pages.dev` e execute `npm test`. Nesse modo o servidor local não é iniciado. Os testes de interface continuam usando dados fictícios do fixture Supabase e não modificam produção; essa execução confere o frontend publicado e não substitui os testes autenticados do banco real.

Revisão atual: 264 testes locais passaram em desktop e celular. Os três testes novos de mudança de sessão reproduziram os defeitos antes da correção e passaram após ela. As quatro RPCs publicadas recusaram acesso anônimo (HTTP 401). Nenhuma alteração de banco foi necessária nesta revisão; os testes autenticados reais da validação abaixo não foram repetidos por falta de credenciais administrativas locais.

Validação em produção em 07/11/2026: implantação Cloudflare Pages confirmada; site público servindo o cache v199. Login real com conta administrativa temporária, exportações CSV/JSON conferidas contra a contagem completa de alunos, download Excel real e controles de troca de classe/resumo do evento verificados sem erros JavaScript. Backup recusado pelo backend para administrador comum. A conta temporária foi removida. Os 145 arquivos atuais do Storage foram baixados e tiveram seus tamanhos conferidos; snapshots global/específico e restauração dos registros foram validados em transação com rollback. Não foi executada restauração efetiva sobre dados de produção.
