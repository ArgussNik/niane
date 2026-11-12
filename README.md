<div align="center">

# 🚀 NiAne

### Sua central de produtividade, organização e evolução pessoal.

<img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-blue?style=flat-square" alt="Status">
<img src="https://img.shields.io/github/license/ArgussNik/niane?style=flat-square&color=green" alt="Licença">
<img src="https://img.shields.io/badge/HTML5-orange?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-blue?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Supabase-integrado-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
<img src="https://img.shields.io/github/stars/ArgussNik/niane?style=flat-square" alt="Stars">

</div>

---

## 📌 Sobre o projeto

O **NiAne** é uma plataforma web de produtividade desenvolvida com o objetivo de centralizar, em um único lugar, as ferramentas essenciais para organização pessoal, estudos e gerenciamento de rotina.

A ideia nasceu da necessidade de reunir, em um único ambiente, recursos que ajudem o usuário a:

- Organizar suas tarefas;
- Planejar sua rotina;
- Aumentar sua concentração;
- Acompanhar seu desenvolvimento;
- Criar hábitos mais produtivos.

Mais do que uma simples lista de tarefas, o NiAne busca ser um ambiente de evolução pessoal, combinando organização, foco e acompanhamento de desempenho em uma interface simples e agradável de usar.

---

## ✨ Funcionalidades

**📋 Organização**
- ✅ Criação e gerenciamento de listas de tarefas
- 📝 Sistema de notas pessoais
- 📅 Organização por datas
- ⚡ Definição de prioridades
- ✔️ Controle de progresso das atividades

**⏳ Produtividade**
- ⏱️ Timer Pomodoro para sessões de foco
- 📊 Dashboard de produtividade
- 📈 Estatísticas de desempenho
- 🎯 Acompanhamento de objetivos

**👤 Usuário**
- 🔐 Sistema de login e cadastro
- ⚙️ Área de configurações pessoais
- 🎨 Personalização de tema

**🎵 Ambiente de foco**
- 🎧 Área de músicas para concentração
- 🌱 Ambiente pensado para estudos e trabalho

---

## 🛠 Tecnologias utilizadas

| Camada | Tecnologias |
|---|---|
| **Frontend** | HTML5 · CSS3 · JavaScript (ES6+) |
| **Backend** *(em desenvolvimento)* | Supabase · PostgreSQL |
| **Ferramentas** | Git · GitHub · Figma · VS Code |

---

## 🏗 Arquitetura do projeto

O projeto segue uma organização modular, separando páginas, estilos, scripts e recursos estáticos:

```text
niane/
├── assets/
│   ├── icons/          # favicons e ícones do app
│   └── images/         # imagens usadas na interface
│
├── css/
│   ├── global.css      # variáveis de tema, reset e estilos base
│   ├── sidebar.css     # menu lateral (compartilhado por todas as páginas)
│   └── ...             # um arquivo de estilo por página (home.css, lists.css, etc.)
│
├── js/
│   ├── niane-shared.js       # estado global, tema e lógica compartilhada
│   ├── niane-theme-init.js   # aplica o tema salvo antes do primeiro paint
│   ├── auth.js / supabase.js / utils.js / app.js   # reservados p/ integração futura
│   └── ...             # um script por página (home.js, lists.js, etc.)
│
├── pages/
│   ├── login.html
│   ├── register.html
│   ├── home.html
│   ├── lists.html
│   ├── notes.html
│   ├── pomodoro.html
│   ├── music.html
│   └── settings.html
│
├── site.webmanifest
├── README.md
└── LICENSE
```

---

## ▶️ Como executar localmente

O projeto é 100% HTML, CSS e JavaScript puro — não exige build nem instalação de dependências.

```bash
# Clone o repositório
git clone https://github.com/ArgussNik/niane.git

# Entre na pasta do projeto
cd niane
```

Em seguida, abra `pages/login.html` diretamente no navegador **ou**, para evitar problemas de CORS com o `localStorage` e os módulos, sirva a pasta com um servidor local simples:

```bash
# usando a extensão Live Server do VS Code
# ou, com Python instalado:
python3 -m http.server 5500
```

E acesse `http://localhost:5500/pages/login.html`.

---

## 🔌 Integração com o Supabase (front-end + back-end)

Os dados de cada usuário (listas, tarefas, notas, sessões Pomodoro, perfil e preferências) ficam no **Supabase (PostgreSQL)**. O projeto continua sendo **HTML + CSS + JavaScript puro**, sem framework e sem servidor Node.

### Estrutura de arquivos relevante

```
js/
  supabase.js        # cria o cliente Supabase (único lugar com URL + chave pública)
  utils.js           # erros padronizados, toast, estados de tela, sanitização, debounce
  auth.js            # cadastro, login, logout, recuperar/alterar senha, sessão
  app.js             # guarda de páginas protegidas + sincronização de preferências
  services/
    lists.service.js  tasks.service.js  notes.service.js
    pomodoro.service.js  profile.service.js  dashboard.service.js
    migration.service.js   # importa dados antigos do localStorage (uma única vez)
pages/reset-password.html  # destino do link "Esqueci minha senha"
supabase/migrations/       # SQL versionado (veja abaixo)
docs/GUIA-INICIANTES.md    # como HTML, JS e Supabase conversam
```

Os scripts são *classic scripts* (não ES Modules) de propósito: assim o projeto continua funcionando abrindo os arquivos direto no navegador (`file://`) e com os `onclick` já existentes nos HTMLs. Cada módulo expõe um objeto global (`NianeAuth`, `NianeUtils`, `NianeServices.*`).

### Configuração do Supabase

1. **Cliente:** `js/supabase.js` já aponta para o projeto NIANE. A URL e a chave `anon` são **públicas por natureza**; a segurança vem do RLS. **Nunca** coloque `service_role`, senhas ou tokens administrativos no repositório (o `.gitignore` já bloqueia `.env*`, `*.local` e chaves).
2. **Autenticação (painel do Supabase → Authentication):**
   - *Providers → Email*: habilitado (confirmação de e-mail recomendada).
   - *URL Configuration → Site URL* e *Redirect URLs*: adicione as URLs onde o app roda (ex.: `http://localhost:5500/pages/login.html`, `http://localhost:5500/pages/reset-password.html` e as URLs de produção). **Sem isso o link de recuperação de senha não funciona.**
3. **Banco:** execute as migrações (próxima seção).

### Migrações SQL

Arquivos em `supabase/migrations/`, para executar **em ordem** no *SQL Editor* do Supabase (ou com `supabase db push`):

| Arquivo | O que faz |
|---|---|
| `001_initial_schema.sql` | Cria as tabelas, chaves, checks e índices. **Atenção:** começa removendo tabelas legadas (`DROP TABLE`) — leia o cabeçalho antes de rodar em um banco com dados. |
| `002_rls_policies.sql` | Liga o RLS e cria as políticas SELECT/INSERT/UPDATE/DELETE por `auth.uid()`. Revoga acesso do papel `anon`. |
| `003_triggers_and_functions.sql` | `updated_at` automático, bloqueio de troca de `user_id`, criação automática de `profiles` + `user_settings` ao cadastrar. |

### Tabelas

| Tabela | Conteúdo | Observações |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `username`, `full_name`, `avatar_url` | criada por trigger no cadastro |
| `lists` | `user_id`, `title`, `period_label`, `start_date`, `end_date`, `position` | |
| `tasks` | `list_id`, `user_id`, `title`, `description`, `is_completed`, `priority`, `due_date`, `due_time`, `position`, `completed_at` | `ON DELETE CASCADE` a partir de `lists` |
| `notes` | `user_id`, `title`, `content` (HTML sanitizado) | |
| `pomodoro_sessions` | `user_id`, `duration_minutes`, `session_type` (`focus`/`short_break`/`long_break`), `completed`, `started_at`, `finished_at` | `id` gerado no navegador → gravação idempotente |
| `user_settings` | `user_id` (único), `theme` (jsonb), tempos do Pomodoro, `total_cycles` | criada por trigger |

### Regras de segurança

- **RLS ligado em todas as tabelas**; o papel `anon` não tem acesso a nenhuma.
- Todas as políticas comparam `user_id = auth.uid()` (em `profiles`, `id = auth.uid()`).
- `tasks` só aceita `INSERT`/`UPDATE` se a `list_id` pertencer ao próprio usuário.
- Um trigger impede alterar o `user_id` de um registro.
- O navegador **não envia** `user_id`: o banco usa `auth.uid()` como padrão.
- Notas passam por um sanitizador (lista de tags/estilos permitidos) antes de serem gravadas e exibidas; textos de usuário são renderizados com `textContent`/escape.
- O Supabase Auth guarda a senha com hash; o front-end nunca a armazena.

### Como executar localmente

```bash
git clone https://github.com/ArgussNik/niane.git
cd niane
python3 -m http.server 5500      # ou Live Server do VS Code
# abra http://localhost:5500/pages/register.html
```

### Como testar

1. **Fluxo manual:** cadastre-se → confirme o e-mail (se a confirmação estiver ativa) → entre → crie lista/tarefas/notas → rode um Pomodoro até o fim → confira a Home → saia e entre de novo (os dados voltam).
2. **Isolamento entre usuários (SQL Editor):** crie dois usuários, e como o usuário B (`set local role authenticated` + `request.jwt.claims`) tente ler, alterar, apagar e inserir registros do usuário A. O resultado esperado é sempre 0 linhas ou erro `42501`.
3. **DevTools:** sem erros no *Console* e sem respostas 4xx/5xx inesperadas na aba *Network*.
4. Rode também o *Security Advisor* do Supabase (Database → Advisors) — não deve apontar tabelas sem RLS.

### Limitações conhecidas

- Dados que já estavam no `localStorage` (versões antigas) são importados **para a primeira conta que entrar naquele navegador** (uma vez; é mantido um backup `*-migrated-backup`).
- Ordenar tarefas funciona por arrastar e soltar com mouse (sem suporte a toque ainda).
- A busca de notas é feita no navegador sobre as notas já carregadas.
- A coluna `user_settings.theme` guarda o tema e a lista de temas salvos; o Pomodoro em andamento (cronômetro) continua local ao navegador, só o histórico de sessões concluídas e os tempos configurados vão para o banco.
- A música continua usando apenas as fontes de áudio já existentes; nenhum áudio é guardado no banco.
- A biblioteca supabase-js é carregada da CDN jsDelivr (versão fixada).

---

## 🎨 Design e prototipação

Antes da implementação, as interfaces foram planejadas no **Figma**, o que permitiu estruturar a experiência do usuário e definir a identidade visual da aplicação.

Principais telas: 🔐 Login · 📝 Cadastro · 🏠 Home · 📋 Listas · ⏱️ Pomodoro · 📝 Notas · 🎵 Música · ⚙️ Configurações

---

## 🎯 Objetivos do projeto

O NiAne tem como propósito auxiliar usuários que desejam melhorar sua organização e produtividade através da tecnologia:

- Melhorar o gerenciamento de tempo;
- Auxiliar estudantes e profissionais;
- Incentivar a criação de hábitos;
- Facilitar o planejamento diário;
- Transformar organização em uma experiência simples e agradável.

---

## 🚧 Roadmap

**Concluído**
- [x] Planejamento da ideia
- [x] Protótipo no Figma
- [x] Estrutura inicial HTML/CSS
- [x] Interface responsiva
- [x] Sistema de páginas e menu lateral compartilhado
- [x] Organização modular do projeto (`assets/`, `css/`, `js/`, `pages/`)

**Em desenvolvimento**
- [x] Integração inicial com Supabase Auth
- [x] Cadastro e login de usuários
- [ ] Banco de dados
- [ ] Dashboard dinâmico
- [x] Sistema local de notas
- [ ] Estatísticas de produtividade

**Futuro**
- [ ] Modo escuro
- [ ] Aplicação mobile
- [ ] Sistema de metas
- [ ] Deploy online

---

## 👥 Equipe

Projeto desenvolvido por:

- [Nicolas Henrique dos Santos de Lima](https://github.com/ArgussNik)
- Alexandre Eitel Ladari
- Nicolai Aleksandr Zilse
- Evellen Hadassa Rodrigues Pereira

---

## 📷 Preview

> Capturas da aplicação serão adicionadas em breve.

---<img width="1919" height="1029" alt="Captura de tela de 2026-11-11 22-36-30" src="https://github.com/user-attachments/assets/5a011112-a45a-4d0c-9b5c-71c1d32ce965" />
<img width="1919" height="1025" alt="Captura de tela de 2026-11-11 22-37-18" src="https://github.com/user-attachments/assets/66ebc7a1-2259-4fd9-a27e-7235bc6a058d" />
<img width="1919" height="1030" alt="Captura de tela de 2026-11-11 22-37-52" src="https://github.com/user-attachments/assets/46d4c407-dfd0-4009-a9e8-07552ecc5bad" />
<img width="1919" height="1028" alt="Captura de tela de 2026-11-11 22-37-38" src="https://github.com/user-attachments/assets/<img width="1919" height="1027" alt="Captura de tela de 2026-11-11 22-38-53" src="https://github.com/user-attachments/assets/ec3c4b6f-90af-44f5-81c4-21348a41e0a3" />
<img width="1918" height="1025" alt="Captura de tela de 2026-11-11 22-38-36" src="https://github.com/user-attachments/assets/c25b8300-d7e3-487c-972c-a6ac3873d2f8" />
<img width="1919" height="1028" alt="Captura de tela de 2026-11-11 22-38-12" src="https://github.com/user-attachments/assets/d26ba633-2f29-42ae-ad3f-d13299d03233" />
1b1ed5e0-6720-40c2-926f-03da36b790dc" />




## 🤝 Contribuindo

Sugestões e correções são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua alteração (`git checkout -b feature/minha-feature`)
3. Faça commit das mudanças (`git commit -m 'feat: minha feature'`)
4. Envie um push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

---

## 📜 Licença

Este projeto está sob a licença **MIT** — veja o arquivo [LICENSE](./LICENSE) para mais detalhes.

---

<div align="center">

### ⭐ Gostou do projeto?

Deixe uma estrela no repositório e acompanhe a evolução do NiAne 🚀

</div>
