-- ============================================================================
-- NIANE — 003_triggers_and_functions.sql
-- ----------------------------------------------------------------------------
-- 1) set_updated_at: mantém updated_at correto (agora com search_path fixo).
-- 2) prevent_owner_change: impede transferir um registro para outro usuário.
-- 3) handle_new_user: cria profile + user_settings quando um usuário se cadastra.
-- 4) Backfill para usuários que já existiam antes desta migração.
-- ============================================================================

-- 1) updated_at ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger lists_set_updated_at         before update on public.lists         for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at         before update on public.tasks         for each row execute function public.set_updated_at();
create trigger notes_set_updated_at         before update on public.notes         for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

-- 2) Propriedade imutável ---------------------------------------------------------
-- Mesmo com RLS, este trigger garante que user_id nunca mude depois de criado.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lists_prevent_owner_change     before update on public.lists             for each row execute function public.prevent_owner_change();
create trigger tasks_prevent_owner_change     before update on public.tasks             for each row execute function public.prevent_owner_change();
create trigger notes_prevent_owner_change     before update on public.notes             for each row execute function public.prevent_owner_change();
create trigger pomodoro_prevent_owner_change  before update on public.pomodoro_sessions for each row execute function public.prevent_owner_change();
create trigger settings_prevent_owner_change  before update on public.user_settings     for each row execute function public.prevent_owner_change();

-- 3) Novo usuário -----------------------------------------------------------------
-- SECURITY DEFINER é necessário porque o trigger roda no contexto do Auth.
-- search_path vazio + nomes totalmente qualificados evitam sequestro de função.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- A função só deve ser executada pelo trigger, nunca chamada pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Backfill (idempotente) --------------------------------------------------------
insert into public.profiles (id, username)
select u.id, nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), '')
from auth.users u
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
