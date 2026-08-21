# 📌 DNMS Check-in

Sistema de check-in com geração e impressão de etiquetas, desenvolvido para controle rápido e eficiente de entrada de usuários.

---

## 📖 Sobre o Projeto

O **DNMS Check-in** é uma aplicação web criada para facilitar o processo de cadastro e impressão de etiquetas em eventos, igrejas ou ambientes organizacionais.

O sistema permite:

* Cadastro de participantes
* Geração automática de etiquetas
* Impressão otimizada para impressoras térmicas (Brother)
* Interface simples e rápida

---

## ⚙️ Funcionalidades

* ✅ Cadastro de usuários
* ✅ Geração de etiquetas personalizada
* ✅ Impressão formatada (padrão Brother)
* ✅ Interface leve e responsiva
* ✅ Fluxo rápido de check-in
* ✅ Autenticação e persistência de sessão com Supabase
* ✅ Confirmação de e-mail no cadastro
* ✅ Perfil Responsável com acesso apenas às próprias crianças
* ✅ Gestão de usuários com papéis (`responsavel`, `equipe`, `admin`, `sadmin`)
* ✅ Dashboard para Admin/Equipe com agenda, informações, atenção e aniversariantes
* ✅ Escalas por usuário (por `profile_id`, e também por e-mail/nome quando aplicável)
* ✅ Mensageria interna (dicas/avisos) com leitura e indicador de não lidas
* ✅ Eventos (salas) com abrir/fechar, edição e controle por turma
* ✅ Check-in por evento com log por período e exportação
* ✅ Reimpressão de etiquetas por check-in do dia no painel de impressão
* ✅ PWA com cache/versionamento

---

## 🖥️ Tecnologias Utilizadas

* HTML5
* CSS3
* JavaScript (Vanilla)
* Supabase (Auth, Postgres, Storage, RLS)

---

## 🏷️ Impressão de Etiquetas

O sistema foi configurado para funcionar com:

* **Impressora:** Brother QL-810W
* **Etiqueta:** DK-11201 (29mm x 90mm)

---

## 📂 Estrutura do Projeto

```
├── index.html
├── app.js
├── print.html
├── print.js
├── styles.css
├── supabase/setup_dnms_checkin.sql
├── supabase/patch_*.sql
├── supabase/BD_BACKUP_2026-03-28.md
└── SUPABASE_SETUP.md
```

---

## 🚀 Como Executar

1. Clone o repositório:

```bash
git clone https://github.com/marcellolabr3/DNMS-Checkin.git
```

2. Acesse a pasta:

```bash
cd DNMS-Checkin
```

3. Abra o arquivo:

```bash
index.html
```

4. Rode os testes automatizados:

```bash
npm install
npm test
```

---

## 📌 Melhorias Futuras

* [x] Integração com banco de dados
* [x] Dashboard administrativo
* [x] Histórico de check-ins
* [x] Autenticação de usuários
* [x] Deploy online
* [x] Redesign visual responsivo
* [x] Navegação lateral no desktop e navegação mobile compacta
* [x] Atualização forçada do PWA ao publicar nova versão
* [x] Carregamento inicial com logo transparente animada, sem piscar a tela de login ao restaurar sessão
* [x] Bloqueio de login para contas Auth sem perfil ativo, evitando recriar usuário excluído
* [x] Checkout automático dos alunos ao fechar ou excluir sala
* [x] Proteção contra mais de um check-in ativo por criança
* [x] Testes automatizados (fluxos críticos e regressão)
  * [x] Testar login, logout e recuperação de senha
  * [x] Testar check-in, checkout manual e checkout automático ao fechar/excluir sala
  * [x] Testar bloqueio de mais de um check-in ativo por criança
  * [x] Testar fluxo do responsável ao visualizar crianças
  * [x] Testar regressões visuais básicas em desktop e celular
* [ ] CI para validação automática
  * [ ] Criar workflow no GitHub Actions
  * [ ] Rodar validações a cada push e pull request
  * [ ] Bloquear merge/publicação quando testes críticos falharem
* [ ] Backup automatizado e versionado de dados (não só estrutura)
  * [ ] Definir rotina de exportação do banco Supabase/Postgres
  * [ ] Salvar backups com data e retenção definida
  * [ ] Documentar processo de restauração
  * [ ] Validar restauração em ambiente seguro
* [ ] Observabilidade de erros em produção
  * [ ] Registrar erros importantes de Supabase e autenticação
  * [ ] Registrar eventos críticos de check-in, checkout e fechamento de sala
  * [ ] Criar padrão de logs sem expor dados sensíveis
  * [ ] Definir rotina de análise dos erros em produção

---

## 🤝 Contribuição

Sinta-se à vontade para contribuir com melhorias, sugestões ou correções.

---

## 📄 Licença

Este projeto está sob a licença MIT.

---

## 👨‍💻 Autor

Desenvolvido por **Marcello Labre**

---

## Atualizacao: Servico Local de Impressao (Windows)

Para evitar popup do navegador e imprimir automaticamente no check-in, o projeto agora usa um servico local:

* Pasta: `Servico de impressao`
* Executavel: `Servico de impressao/dist/Servico-de-impressao.exe`
* API local: `http://localhost:3001` (`/print` e `/reprint`)
* Impressao em **1 etiqueta por vez** (1 pagina, 90mm x 29mm)

Fluxo operacional:

1. Inicie `Iniciar Servico de impressao.cmd`
2. O servico sobe localmente e fica em segundo plano (bandeja)
3. Ao fazer check-in no app, a etiqueta e enviada para o servico local e impressa na impressora padrao do Windows

Observacoes:

* Se o servico nao estiver ativo, o app informa indisponibilidade do servico.
* O app nao usa fallback de popup de impressao para check-in/reimpressao.
* Check-in feito no celular nao abre popup e a etiqueta e impressa no desktop via listener/polling do servico local.
* Health esperado do servico:

```json
{"ok":true,"status":"online","target_printer":"Brother QL-810W USB","auto_print_listener":true,"auto_print_polling":true,"supabase_role":"service_role"}
```

* Se ainda nao imprimir, verifique se nao existe outro `Servico-de-impressao.exe` rodando em outra pasta/projeto.
