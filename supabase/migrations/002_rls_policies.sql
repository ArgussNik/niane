-- ============================================================================
-- NIANE — 002_rls_policies.sql
-- ----------------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga e altera os PRÓPRIOS dados.
-- Todas as políticas usam auth.uid() (identidade real vinda do JWT validado
-- pelo Supabase), nunca um identificador enviado pelo navegador.
--
-- `(select auth.uid())` é usado de propósito: o Postgres avalia a função uma
-- única vez por consulta (initplan) em vez de uma vez por linha.
--
-- Nenhuma política é concedida ao papel `anon`: visitantes sem login não
-- têm acesso a nenhuma tabela.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.lists             enable row level security;
alter table public.tasks             enable row level security;
alter table public.notes             enable row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.user_settings     enable row level security;

-- Defesa em profundidade: o papel anon não precisa de nenhum privilégio.
revoke all on public.profiles, public.lists, public.tasks, public.notes,
              public.pomodoro_sessions, public.user_settings from anon;

-- profiles --------------------------------------------------------------------
-- O perfil é criado pelo trigger handle_new_user (003); o usuário só lê e edita.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- lists -----------------------------------------------------------------------
create policy "lists_select_own" on public.lists
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "lists_insert_own" on public.lists
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "lists_update_own" on public.lists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "lists_delete_own" on public.lists
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- tasks -----------------------------------------------------------------------
-- Além de user_id = auth.uid(), a tarefa só pode apontar para uma lista que
-- também pertença ao usuário. Isso impede criar ou mover tarefas para listas
-- de terceiros.
create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.lists l
      where l.id = list_id and l.user_id = (select auth.uid())
    )
  );

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.lists l
      where l.id = list_id and l.user_id = (select auth.uid())
    )
  );

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notes -----------------------------------------------------------------------
create policy "notes_select_own" on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notes_insert_own" on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notes_update_own" on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notes_delete_own" on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- pomodoro_sessions -----------------------------------------------------------
create policy "pomodoro_select_own" on public.pomodoro_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "pomodoro_insert_own" on public.pomodoro_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "pomodoro_update_own" on public.pomodoro_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pomodoro_delete_own" on public.pomodoro_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- user_settings ---------------------------------------------------------------
create policy "settings_select_own" on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "settings_insert_own" on public.user_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "settings_delete_own" on public.user_settings
  for delete to authenticated
  using (user_id = (select auth.uid()));
