-- ============================================================================
-- NIANE — 001_initial_schema.sql
-- ----------------------------------------------------------------------------
-- Cria o modelo de dados do NIANE: profiles, lists, tasks, notes,
-- pomodoro_sessions e user_settings.
--
-- ATENÇÃO (autorizado explicitamente pelo responsável do projeto em 2026-11-09):
-- as 5 tabelas legadas abaixo estavam VAZIAS (0 linhas), sem RLS e com chaves
-- estrangeiras incorretas (apontavam para todos_registro.id em vez de
-- auth.users). Elas são removidas e substituídas pelo modelo novo:
--   public.home, public.pomodoro, public.listas, public.notes,
--   public.todos_registro
--
-- Esta migração NÃO deve ser reaplicada em um banco que já tenha dados nessas
-- tabelas legadas com o mesmo nome (a tabela `notes` nova tem outro formato).
-- ============================================================================

-- 1) Remoção das tabelas legadas (ordem respeita as FKs) -----------------------
drop table if exists public.home cascade;
drop table if exists public.pomodoro cascade;
drop table if exists public.listas cascade;
drop table if exists public.notes cascade;
drop table if exists public.todos_registro cascade;

-- 2) profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_length check (username is null or char_length(username) between 1 and 60),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 120)
);

-- 3) lists ---------------------------------------------------------------------
-- period_label guarda o texto livre exibido hoje na interface ("Seg - quarta").
-- start_date / end_date ficam disponíveis para períodos estruturados.
create table if not exists public.lists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  description   text,
  period_label  text,
  start_date    date,
  end_date      date,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lists_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint lists_period_label_length check (period_label is null or char_length(period_label) <= 120),
  constraint lists_dates_order check (start_date is null or end_date is null or end_date >= start_date)
);

-- 4) tasks ---------------------------------------------------------------------
-- Excluir uma lista exclui suas tarefas (ON DELETE CASCADE).
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lists (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  description   text,
  is_completed  boolean not null default false,
  priority      text,
  due_date      date,
  due_time      time,
  position      integer not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 300),
  constraint tasks_description_length check (description is null or char_length(description) <= 5000),
  constraint tasks_priority_valid check (priority is null or priority in ('alta', 'media', 'baixa'))
);

-- 5) notes ---------------------------------------------------------------------
-- content guarda HTML já sanitizado pelo front-end (lista de tags permitidas);
-- o limite de tamanho evita abuso de armazenamento.
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notes_title_length check (char_length(title) <= 200),
  constraint notes_content_length check (char_length(content) <= 500000)
);

-- 6) pomodoro_sessions ---------------------------------------------------------
create table if not exists public.pomodoro_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  duration_minutes  integer not null,
  session_type      text not null,
  completed         boolean not null default true,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  constraint pomodoro_duration_range check (duration_minutes between 1 and 720),
  constraint pomodoro_type_valid check (session_type in ('focus', 'short_break', 'long_break')),
  constraint pomodoro_finish_after_start check (finished_at is null or finished_at >= started_at)
);

-- 7) user_settings -------------------------------------------------------------
-- theme guarda a paleta personalizada (objeto JSON com as cores do app).
create table if not exists public.user_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  theme                 jsonb,
  focus_duration        integer not null default 25,
  short_break_duration  integer not null default 5,
  long_break_duration   integer not null default 15,
  total_cycles          integer not null default 4,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint user_settings_focus_range check (focus_duration between 1 and 240),
  constraint user_settings_short_range check (short_break_duration between 1 and 120),
  constraint user_settings_long_range check (long_break_duration between 1 and 240),
  constraint user_settings_cycles_range check (total_cycles between 1 and 20)
);

-- 8) Índices (FKs e consultas frequentes) ---------------------------------------
create index if not exists lists_user_id_idx on public.lists (user_id, position);
create index if not exists tasks_list_id_idx on public.tasks (list_id, position);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists pomodoro_user_started_idx on public.pomodoro_sessions (user_id, started_at desc);
