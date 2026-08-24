-- ============================================================================
-- Portal da Mocidade Shoham
-- Migração 0003 — Estudos/Materiais e Presença vinculada a Eventos
--
-- TIPO: ADITIVA. Depende da 0001 (profiles, is_leadership, set_updated_at)
-- e da 0002 (events).
--
-- Decisão de design: o CLAUDE.md sugere `studies` + `study_categories` +
-- `study_materials` como três tabelas. Uni tudo numa `studies` só —
-- "Materiais Complementares" já é um dos 4 tipos de conteúdo listados na
-- seção 8, então um estudo já É o material (texto, PDF, vídeo ou
-- complementar), sem precisar de uma tabela de anexos à parte pra esse
-- estágio. Categoria vira um CHECK (mesmo padrão de events/announcements),
-- não uma tabela — mesmo raciocínio da migração 0001 pro enum de papéis.
-- Se um estudo precisar de vários anexos ao mesmo tempo no futuro
-- (ex: texto + PDF + vídeo juntos), aí sim separar em study_materials.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. studies (seção 8 — módulo Estudos e Materiais)
--
-- ⚠️ Regra fundamental do CLAUDE.md (seção 8): NUNCA gerar/completar
-- conteúdo bíblico por conta própria. Esta migração só cria a estrutura —
-- o conteúdo real (body_text, resource_url) é preenchido pela liderança
-- pela tela, nunca por mim.
-- ----------------------------------------------------------------------------

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  category text not null check (
    category in (
      'Bíblia', 'Vida Cristã', 'Liderança', 'Evangelismo', 'Relacionamentos',
      'Família', 'Propósito', 'Discipulado', 'Caráter', 'Serviço', 'Fé'
    )
  ),
  content_type text not null check (content_type in ('texto', 'pdf', 'video', 'material_complementar')),

  -- Preenchido conforme o content_type: texto usa body_text; pdf/video/
  -- material_complementar usam resource_url (link externo ou Supabase
  -- Storage). Não força um ou outro no banco pra não travar casos mistos
  -- (ex: texto introdutório + link de um vídeo relacionado).
  body_text text,
  resource_url text,

  author_id uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studies_category_idx on public.studies (category);
create index if not exists studies_published_at_idx on public.studies (published_at desc);

drop trigger if exists studies_set_updated_at on public.studies;
create trigger studies_set_updated_at
  before update on public.studies
  for each row
  execute function public.set_updated_at();

alter table public.studies enable row level security;

drop policy if exists "studies_select_all" on public.studies;
create policy "studies_select_all"
  on public.studies for select
  to authenticated
  using (true);

drop policy if exists "studies_insert_leadership" on public.studies;
create policy "studies_insert_leadership"
  on public.studies for insert
  to authenticated
  with check (public.is_leadership(auth.uid()) and author_id = auth.uid());

drop policy if exists "studies_update_leadership" on public.studies;
create policy "studies_update_leadership"
  on public.studies for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

grant select, insert, update on public.studies to authenticated;

-- ----------------------------------------------------------------------------
-- 2. attendance (seção 8 — Presença, vinculada a Eventos)
--
-- Diferente de event_participants (confirmação PRÉVIA / RSVP): attendance
-- é o registro do que de fato aconteceu no dia, feito pela liderança.
-- ----------------------------------------------------------------------------

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  present boolean not null default true,
  marked_by uuid references public.profiles (id),
  marked_at timestamptz not null default now(),

  unique (event_id, profile_id)
);

create index if not exists attendance_event_idx on public.attendance (event_id);
create index if not exists attendance_profile_idx on public.attendance (profile_id);

alter table public.attendance enable row level security;

-- Privacidade: cada um só vê a própria presença; liderança vê tudo
-- (precisa, pra registrar e pra ver os indicadores).
drop policy if exists "attendance_select_own_or_leadership" on public.attendance;
create policy "attendance_select_own_or_leadership"
  on public.attendance for select
  to authenticated
  using (profile_id = auth.uid() or public.is_leadership(auth.uid()));

-- Só liderança registra presença (nunca a própria pessoa se automarca).
drop policy if exists "attendance_insert_leadership" on public.attendance;
create policy "attendance_insert_leadership"
  on public.attendance for insert
  to authenticated
  with check (public.is_leadership(auth.uid()) and marked_by = auth.uid());

drop policy if exists "attendance_update_leadership" on public.attendance;
create policy "attendance_update_leadership"
  on public.attendance for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

grant select, insert, update on public.attendance to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Indicadores básicos (seção 8 — visão do líder, "evitar competição
-- negativa entre os jovens": por isso essas funções são só pra liderança
-- e trabalham com AGREGADOS por evento, nunca ranking individual público.
-- ----------------------------------------------------------------------------

-- Confirmados x presentes de um evento, só pra quem é líder/admin.
create or replace function public.event_attendance_summary(p_event_id uuid)
returns table (confirmed_count bigint, attended_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.event_participants where event_id = p_event_id) as confirmed_count,
    (select count(*) from public.attendance where event_id = p_event_id and present) as attended_count
  where public.is_leadership(auth.uid());
$$;

revoke all on function public.event_attendance_summary(uuid) from public;
grant execute on function public.event_attendance_summary(uuid) to authenticated;
