# Central de dados do Log

O seletor **Operação** concentra os quatro relatórios existentes, responsáveis e filhos, os cadastros de crianças (incluindo previsão anual de troca de classe), a consulta ao banco e os backups. Não há uma seção independente de Extração. A aba Famílias oferece somente o atalho **Consultar no Log**, que mantém a busca digitada e abre o relatório; todos os downloads são feitos no Log.

- Equipe mantém os relatórios e as permissões anteriores, incluindo responsáveis e filhos. Esse relatório preserva contatos, quantidade e nomes dos filhos vinculados; oferece CSV, Excel e JSON, busca por nome/email/telefone e consulta de todos os responsáveis quando a busca está vazia.
- Admin/sadmin pode extrair os registros autorizados pelas políticas RLS existentes. O catálogo mostra as tabelas disponíveis ao usuário. Não há limite de mil linhas: cada consulta usa uma RPC que agrega os resultados completos em um único snapshot. Se a consulta exceder recursos do servidor ou falhar, nenhum arquivo é oferecido como concluído.
- Somente sadmin pode gerar backup global ou específico, pois ambos incluem contas de autenticação. A autorização é conferida novamente no banco, usando `auth.uid()` e o e-mail da conta em `auth.users`.

## Consulta e formatos

A **Assiduidade** consulta o histórico de check-ins, incluindo crianças que já fizeram checkout. Cada criança conta uma presença por sala/evento e dia; reentradas no mesmo evento/dia não duplicam a frequência, e participações em outros dias ou eventos continuam separadas. Salas de teste ficam fora do relatório. Os totais acompanham os filtros de período, turma, nome e crianças selecionadas em tela, CSV, Excel, JSON e WhatsApp. O painel **Presentes agora** continua usando somente as presenças ativas.

O período inicial vai do primeiro registro disponível no snapshot completo do Log até hoje: considera `created_at` de cadastros, responsáveis, vínculos, salas e auditoria, além de `checked_in_at` das presenças, no fuso local. Não usa nascimento nem a data agendada do evento. Datas alteradas manualmente são preservadas em atualizações e exportações; **Desde o primeiro registro** restaura o período completo. A troca de sessão limpa esse estado. A busca por nome aceita diferenças de acentuação, e a seleção inclui crianças cadastradas sem check-in no período, que aparecem com **0 presenças** quando consultadas.

Com **Excel** selecionado, o botão **Enviar Excel no WhatsApp** compartilha o documento `.xlsx` da exportação, com o mesmo nome e conteúdo, preservando abas, resumo e Membro/Visitante. Depois de usar **Exportar**, o arquivo fica pronto para compartilhar sem consultar o banco novamente. O sistema abre o seletor de compartilhamento do aparelho; o usuário escolhe WhatsApp, conversa e confirma o envio. Se ainda não houver Excel gerado, o primeiro clique prepara a planilha e apresenta **Compartilhar arquivo**, garantindo um novo gesto do usuário antes de abrir o seletor.

Quando o navegador não permite compartilhar esse tipo de arquivo, o diálogo oferece **Baixar Excel** e orienta anexá-lo em **WhatsApp → Anexar → Documento**, com atalho para o WhatsApp Web. Não há envio de texto como substituto do Excel nem upload público de dados. Cancelar o compartilhamento não abre mensagens nem baixa outro arquivo. Trocar filtros ou sessão invalida o arquivo preparado; sair remove o documento da memória. Os formatos CSV/JSON mantêm o compartilhamento de texto anterior, onde já disponível. Backups administrativos não entram nesse fluxo.

As prévias e exportações de crianças incluem **Membro/Visitante** ao lado do nome, inclusive na previsão anual de troca de classe, em CSV, Excel, JSON e no texto para WhatsApp. A classificação vem de `students.is_visitor`: `true` é Visitante e `false` é Membro; não é inferida da turma nem do responsável. O JSON de cadastros acrescenta `membership` e conserva `isVisitor`. O resumo do Excel separa os totais de membros e visitantes.

Frequência e auditoria identificam o vínculo da criança; responsáveis e filhos preservam a lista original de nomes e acrescentam uma coluna que identifica cada filho, inclusive em famílias mistas. O resumo do evento inclui grupos por vínculo com quantidade de check-ins e de crianças distintas. Na consulta de tabelas com crianças ou `student_id`, e na auditoria, a coluna **Membro/Visitante** é acrescentada mesmo se os campos originais forem selecionados parcialmente. Os registros relacionados vêm da mesma RPC/snapshot, respeitando RLS. Se o cadastro não existir mais, o vínculo aparece como **Não identificado**; ações sem relação com crianças ficam sem classificação infantil. É a classificação atual do cadastro, não uma reconstrução histórica. Backups mantêm o `is_visitor` original e seu formato de recuperação.

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

Testes de interface: `npm test -- tests/log-attendance.spec.js tests/log-excel-share.spec.js tests/log-membership.spec.js tests/log-center.spec.js tests/checkin.spec.js tests/service-worker.spec.js`. O teste de compartilhamento usa a mesma edição SheetJS 0.18.5 do aplicativo (dependência apenas de desenvolvimento), abre o XLSX real e compara os bytes do download e do anexo. A chamada ao compartilhamento nativo é simulada; nenhum documento é enviado a contatos durante os testes. Use `PLAYWRIGHT_PORT` quando a porta padrão 4173 estiver ocupada por outro checkout. Esta alteração precisa servir `app.js?v=20261110c`, `log-center.js?v=20261110c`, `styles.css?v=20261108d` e `checkin-cache-v204`.

Para executar a suíte contra os arquivos publicados, defina `PLAYWRIGHT_BASE_URL=https://dnms-checkin.pages.dev` e execute `npm test`. Nesse modo o servidor local não é iniciado. Os testes de interface continuam usando dados fictícios do fixture Supabase e não modificam produção; essa execução confere o frontend publicado e não substitui os testes autenticados do banco real.

Revisão de assiduidade: 246 testes locais passaram em desktop e celular, cobrindo histórico após checkout, reentradas, dias/eventos distintos, exclusão de salas de teste, busca e seleção com zero presenças, período desde o cadastro mais antigo, fuso local, datas manuais, sessão e mais de mil registros. A verificação também incluiu Log, Excel real, check-in, dashboard e cache. Sintaxe JavaScript e `git diff --check` passaram. Sem alteração de banco/RLS; os testes usaram fixtures Supabase. Cache v204 validado localmente, ainda não publicado.

Validação publicada do cache v200: o check Cloudflare Pages do commit `33ef657` concluiu com sucesso. `index.html`, `app.js`, `log-center.js` e `sw.js` publicados correspondem ao checkout (normalizando BOM e finais de linha). A suíte completa passou novamente: 264 testes contra o frontend publicado em desktop/celular, com fixtures Supabase. A inicialização da página real de login foi conferida sem erros JavaScript. O atalho de Famílias, o download de Excel com a biblioteca XLSX real e a leitura de suas células, JSON e a verificação offline dos backups global/específico passaram usando dados de teste. Não houve operações autenticadas nem restauração sobre dados reais nessa revisão. A suíte reconhece a URL canônica `/` do Pages e remove corretamente a API de service worker nos fixtures, sem produzir erros artificiais de inicialização.

Validação em produção em 07/11/2026: implantação Cloudflare Pages confirmada; site público servindo o cache v199. Login real com conta administrativa temporária, exportações CSV/JSON conferidas contra a contagem completa de alunos, download Excel real e controles de troca de classe/resumo do evento verificados sem erros JavaScript. Backup recusado pelo backend para administrador comum. A conta temporária foi removida. Os 145 arquivos atuais do Storage foram baixados e tiveram seus tamanhos conferidos; snapshots global/específico e restauração dos registros foram validados em transação com rollback. Não foi executada restauração efetiva sobre dados de produção.
