<div align="center">

# 🚀 NiAne

### Sua central de produtividade, organização e evolução pessoal.

<img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-blue?style=flat-square" alt="Status">
<img src="https://img.shields.io/github/license/ArgussNik/niane?style=flat-square&color=green" alt="Licença">
<img src="https://img.shields.io/badge/HTML5-orange?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-blue?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Supabase-em%20breve-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
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
- [ ] Integração com Supabase
- [ ] Autenticação de usuários
- [ ] Banco de dados
- [ ] Dashboard dinâmico
- [ ] Sistema completo de notas
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

---

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
