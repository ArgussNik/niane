# Guia para iniciantes — como HTML, JavaScript e Supabase conversam no NIANE

Este guia explica, sem jargão, o caminho que um clique percorre até o banco de dados.

## 1. Quem é quem

| Peça | O que é | Onde fica |
|---|---|---|
| **HTML/CSS** | A tela: botões, listas, cores | `pages/*.html`, `css/*.css` |
| **JavaScript da página** | Reage aos cliques e desenha a tela | `js/lists.js`, `js/notes.js`, `js/home.js`… |
| **Serviços** | Falam com o banco (criar, ler, editar, apagar) | `js/services/*.service.js` |
| **Cliente Supabase** | A "ponte" com a internet | `js/supabase.js` |
| **Autenticação** | Cadastro, login, logout, senha | `js/auth.js` |
| **Supabase / PostgreSQL** | O banco, na nuvem, e as regras de segurança (RLS) | `supabase/migrations/*.sql` |

A regra de ouro: **o JavaScript da página nunca fala direto com o banco.** Ele chama um serviço, e o serviço fala com o Supabase.

## 2. O caminho de um clique

Exemplo: você clica em **Adicionar** numa tarefa.

1. `lists.js` lê o que você digitou e chama `NianeServices.tasks.create(...)`.
2. `tasks.service.js` valida os dados (título vazio? grande demais?) e chama o Supabase: `supabase.from('tasks').insert(...)`.
3. O Supabase envia o pedido junto com o seu **token de login** (o `supabase.js` cuida disso).
4. No banco, o **RLS** confere: "este token pertence a quem? Essa lista é dele?". Se não for, recusa.
5. A resposta volta; o serviço devolve o resultado ou um erro com mensagem em português.
6. `lists.js` atualiza a tela (ou mostra o erro com `NianeUtils.toast`).

Se qualquer passo falhar, **a tela não finge que deu certo**.

## 3. Por que é seguro expor a chave no JavaScript?

O arquivo `js/supabase.js` tem a URL do projeto e a chave **anon** (pública). Qualquer pessoa pode vê-las no navegador, e tudo bem: elas só identificam o projeto. A proteção real está no banco: o RLS só devolve linhas cujo `user_id` é igual ao `auth.uid()` de quem pediu.

Nunca coloque no código: a chave `service_role`, a senha do banco, ou tokens de administrador. Essas, sim, são segredos e ignoram o RLS.

## 4. Como cada página começa

Todas as páginas internas carregam, nesta ordem: biblioteca supabase-js → `supabase.js` → `utils.js` → `auth.js` → serviços → `app.js` → script da página.

`app.js` pergunta ao servidor "quem é você?". Sem sessão válida, manda para `login.html`. Com sessão, avisa a página (`NianeApp.ready`) e ela busca seus dados.

## 5. Receitas

**Criar uma nova funcionalidade que grava dados**
1. Crie a tabela em uma nova migração (`supabase/migrations/00X_...sql`) **com RLS e políticas**.
2. Crie `js/services/minha.service.js` com `create/list/update/remove`, usando `NianeUtils.unwrap(...)` para padronizar erros.
3. Inclua o arquivo nas páginas que usam.
4. Na página, chame o serviço dentro de `try/catch` e use `NianeUtils.reportError(err)`.

**Ver o que o banco devolve**: abra o DevTools (F12) → aba *Network* → filtre por `supabase.co`.

**"Permissão negada" ao salvar?** Quase sempre é uma política RLS faltando para aquela operação, ou o usuário não está logado.
