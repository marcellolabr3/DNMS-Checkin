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

---

## 📌 Melhorias Futuras

* [x] Integração com banco de dados
* [x] Dashboard administrativo
* [x] Histórico de check-ins
* [x] Autenticação de usuários
* [x] Deploy online
* [ ] Testes automatizados (fluxos críticos e regressão)
* [ ] CI para validação automática
* [ ] Backup automatizado e versionado de dados (não só estrutura)
* [ ] Observabilidade de erros em produção

---

## 🤝 Contribuição

Sinta-se à vontade para contribuir com melhorias, sugestões ou correções.

---

## 📄 Licença

Este projeto está sob a licença MIT.

---

## 👨‍💻 Autor

Desenvolvido por **Marcello Labre**
