-- ============================================================================
-- Portal da Mocidade Shoham
-- Migração 0002 — Eventos, confirmação de presença e comunicados
--
-- TIPO: ADITIVA. Só cria tabelas/funções novas — não altera nem remove
-- nada da migração 0001. Segura para aplicar em qualquer ambiente que já
-- tenha a 0001 aplicada.
--
-- Como aplicar: SQL Editor do Supabase, colar e rodar. Depende da 0001
-- (usa public.profiles, public.is_leadership, public.set_updated_at).
--
-- Entidades cobertas: events, event_participants, announcements
-- (seção 11 do CLAUDE.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. events (seção 8 — módulo Eventos)
--
-- Sem policy de DELETE: um evento indesejado é CANCELADO (status), nunca
-- apagado — preserva histórico e evita quebrar confirmações já feitas.
-- ----------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  category text not null check (
    category in (
      'Culto', 'Encontro de Jovens', 'Congresso', 'Estudo', 'Retiro',
      'Ação Social', 'Ensaio', 'Reunião', 'Evento Especial'
    )
  ),
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  image_url text,

  status text not null default 'ativo' check (status in ('ativo', 'cancelado')),

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_ends_after_starts check (ends_at is null or ends_at >= starts_at)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_status_idx on public.events (status);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

alter table public.events enable row level security;

-- Todo mundo autenticado pode ver todos os eventos (inclusive cancelados,
-- com o status visível — quem decide esconder da lista principal é a UI).
drop policy if exists "events_select_all" on public.events;
create policy "events_select_all"
  on public.events for select
  to authenticated
  using (true);

drop policy if exists "events_insert_leadership" on public.events;
create policy "events_insert_leadership"
  on public.events for insert
  to authenticated
  with check (public.is_leadership(auth.uid()) and created_by = auth.uid());

drop policy if exists "events_update_leadership" on public.events;
create policy "events_update_leadership"
  on public.events for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

grant select, insert, update on public.events to authenticated;

-- ----------------------------------------------------------------------------
-- 2. event_participants (confirmação de presença — seção 8, "Participação")
--
-- Guarda só a CONFIRMAÇÃO (RSVP). O registro da presença de fato no dia
-- do evento é um módulo à parte (Fase 3 do roadmap, tabela `attendance`),
-- ainda não criado aqui.
-- ----------------------------------------------------------------------------

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  confirmed_at timestamptz not null default now(),

  unique (event_id, profile_id)
);

create index if not exists event_participants_event_idx on public.event_participants (event_id);
create index if not exists event_participants_profile_idx on public.event_participants (profile_id);

alter table public.event_participants enable row level security;

-- Privacidade: um jovem vê a própria confirmação, não a lista de quem mais
-- confirmou (evita virar vitrine social/comparação — seção 8, regra sobre
-- gamificação/rankings). Liderança vê tudo, pra logística.
drop policy if exists "event_participants_select_own_or_leadership" on public.event_participants;
create policy "event_participants_select_own_or_leadership"
  on public.event_participants for select
  to authenticated
  using (profile_id = auth.uid() or public.is_leadership(auth.uid()));

-- Confirma presença: a própria pessoa, ou a liderança em nome de alguém
-- (ex: alguém sem acesso ao app que confirmou verbalmente).
drop policy if exists "event_participants_insert_self_or_leadership" on public.event_participants;
create policy "event_participants_insert_self_or_leadership"
  on public.event_participants for insert
  to authenticated
  with check (profile_id = auth.uid() or public.is_leadership(auth.uid()));

-- Desfazer confirmação: a própria pessoa, ou a liderança.
drop policy if exists "event_participants_delete_own_or_leadership" on public.event_participants;
create policy "event_participants_delete_own_or_leadership"
  on public.event_participants for delete
  to authenticated
  using (profile_id = auth.uid() or public.is_leadership(auth.uid()));

grant select, insert, delete on public.event_participants to authenticated;

-- Contagem de confirmados de um evento, sem expor quem são (qualquer
-- pessoa autenticada pode chamar — só retorna um número).
create or replace function public.event_participant_count(p_event_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.event_participants where event_id = p_event_id;
$$;

revoke all on function public.event_participant_count(uuid) from public;
grant execute on function public.event_participant_count(uuid) to authenticated;

-- Diz se a própria pessoa já confirmou presença num evento (conveniência
-- para a UI, evita depender de conseguir ler a linha via SELECT direto).
create or replace function public.has_confirmed_presence(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants
    where event_id = p_event_id and profile_id = auth.uid()
  );
$$;

revoke all on function public.has_confirmed_presence(uuid) from public;
grant execute on function public.has_confirmed_presence(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. announcements (seção 8 — módulo Comunicados)
--
-- Sem policy de DELETE: um comunicado indesejado é ARQUIVADO
-- (archived_at), nunca apagado — mesmo raciocínio de events.
-- ----------------------------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text not null,
  category text not null check (
    category in ('Aviso', 'Comunicado', 'Lembrete', 'Evento', 'Estudo', 'Liderança', 'Importante')
  ),
  image_url text,
  -- Valores de prioridade não estavam especificados no CLAUDE.md (só o
  -- campo "Prioridade" era citado) — optei por um binário simples.
  priority text not null default 'normal' check (priority in ('normal', 'alta')),

  author_id uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_published_at_idx on public.announcements (published_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "announcements_select_all" on public.announcements;
create policy "announcements_select_all"
  on public.announcements for select
  to authenticated
  using (true);

drop policy if exists "announcements_insert_leadership" on public.announcements;
create policy "announcements_insert_leadership"
  on public.announcements for insert
  to authenticated
  with check (public.is_leadership(auth.uid()) and author_id = auth.uid());

drop policy if exists "announcements_update_leadership" on public.announcements;
create policy "announcements_update_leadership"
  on public.announcements for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

grant select, insert, update on public.announcements to authenticated;
