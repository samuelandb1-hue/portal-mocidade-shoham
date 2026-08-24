-- ============================================================================
-- Portal da Mocidade Shoham
-- Migração 0001 — Fundação de autenticação: perfis, papéis e consentimentos
--
-- TIPO: ADITIVA. Só cria tipos/tabelas/funções novas — não altera nem
-- remove nada existente. Segura para aplicar em qualquer ambiente.
--
-- Como aplicar: copie todo este arquivo e cole no SQL Editor do Supabase
-- (Dashboard → SQL Editor → New query → Run). Não requer CLI nem terminal.
--
-- Entidades cobertas: profiles, user_consents (seção 11 do CLAUDE.md).
--
-- Decisão de design (fora do que estava listado no CLAUDE.md, registrando
-- aqui em vez de aplicar em silêncio — seção 12, regra 4):
-- O CLAUDE.md sugere uma tabela `roles` separada. Como hoje existem só 3
-- papéis fixos (jovem/líder/administrador) e a regra de negócio é 1 papel
-- por pessoa, optei por um ENUM (`user_role`) em vez de tabela + join.
-- É mais simples (princípio #1 da seção 4) e ainda assim extensível: dá
-- pra adicionar um novo valor ao enum depois (`ALTER TYPE ... ADD VALUE`,
-- também aditivo). Se no futuro a mocidade precisar de múltiplos papéis
-- por pessoa (ex: alguém líder em um grupo e jovem em outro), aí sim vale
-- migrar para uma tabela `roles` + `user_roles` — decisão a ser tomada
-- quando essa necessidade aparecer de verdade, não antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Papéis de acesso (seção 6 do CLAUDE.md)
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('jovem', 'lider', 'administrador');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. profiles — dados do jovem/líder/admin, 1:1 com auth.users
--
-- Preenchida pelo próprio app no momento do cadastro (após o login por
-- WhatsApp), não por trigger automática — porque nome, data de nascimento
-- e (se menor) dados do responsável precisam ser coletados juntos, no
-- mesmo fluxo de consentimento LGPD.
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  full_name text not null,
  phone text not null unique, -- espelha auth.users.phone (E.164), pois a
                               -- API de auth do Supabase não é consultável
                               -- diretamente pelo client via PostgREST.
  birth_date date not null,
  email text, -- opcional (seção 9: minimização de dados)
  avatar_url text,

  role public.user_role not null default 'jovem',

  -- Preenchidos apenas quando o titular é menor de idade. Consentimento
  -- em si fica registrado em user_consents; aqui é só o contato.
  guardian_name text,
  guardian_phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Consentimento parental "desde o design" (regra 7, seção 12): se a
  -- pessoa é menor de 18 anos, os dados do responsável são obrigatórios
  -- já na criação do perfil — não é possível cadastrar um menor sem isso.
  constraint guardian_contact_required_for_minors check (
    birth_date <= (current_date - interval '18 years')::date
    or (guardian_name is not null and guardian_phone is not null)
  )
);

create index if not exists profiles_role_idx on public.profiles (role);

comment on table public.profiles is
  'Dados de perfil de cada usuário (jovem/líder/administrador). 1:1 com auth.users.';
comment on column public.profiles.phone is
  'Cópia de auth.users.phone em E.164, mantida em sincronia pelo app a cada troca de número.';

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Funções auxiliares de autorização
--
-- SECURITY DEFINER + dono da tabela (que não sofre RLS por padrão) evita
-- o problema clássico de recursão: uma policy em `profiles` que precisasse
-- consultar `profiles` diretamente entraria em loop com a própria RLS.
-- ----------------------------------------------------------------------------

create or replace function public.is_leadership(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('lider', 'administrador')
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'administrador'
  );
$$;

revoke all on function public.is_leadership(uuid) from public;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_leadership(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- Impede que o próprio usuário se autopromova a líder/administrador ao
-- editar o próprio perfil. Só líderes/admins podem mudar o campo `role`
-- (de qualquer pessoa, inclusive a própria).
--
-- A checagem só se aplica quando auth.uid() existe, ou seja, quando a
-- alteração vem de um usuário autenticado passando pela API (PostgREST).
-- Uma execução direta no SQL Editor (ou via service_role, que já ignora
-- RLS) não tem esse contexto — sem essa condição, nem você conseguiria
-- promover a primeira pessoa a líder, já que nesse momento ninguém ainda
-- é líder para "autorizar" a promoção (bug encontrado e corrigido durante
-- testes locais desta migração).
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_leadership(auth.uid()) then
    raise exception 'Apenas líderes ou administradores podem alterar o nível de acesso.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_self_escalation on public.profiles;
create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_self_escalation();

-- ----------------------------------------------------------------------------
-- 4. RLS — profiles
--
-- Privacidade por padrão (seção 9): telefone, e-mail, data de nascimento e
-- dados do responsável só são visíveis para o próprio dono do perfil e
-- para líderes/administradores. Nunca para outros jovens.
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_leadership" on public.profiles;
create policy "profiles_select_own_or_leadership"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_leadership(auth.uid()));

-- Cadastro: o próprio usuário cria seu perfil (uma vez, pk = auth.uid()),
-- e sempre como 'jovem' — promoção a líder/admin é feita depois, por
-- alguém da liderança, nunca pela própria pessoa no cadastro.
drop policy if exists "profiles_insert_self_as_jovem" on public.profiles;
create policy "profiles_insert_self_as_jovem"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'jovem');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_leadership" on public.profiles;
create policy "profiles_update_leadership"
  on public.profiles for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

-- Sem policy de DELETE: exclusão de conta (direito do titular, seção 9)
-- é tratada como processo administrativo (Fase 5 do roadmap), não como
-- delete direto pelo client — evita perda acidental/maliciosa de dados
-- que outras tabelas (eventos, presença) referenciam.

grant select, insert, update on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- 5. user_consents — trilha de consentimento LGPD (append-only)
--
-- Log imutável: cada linha é um "evento" de consentimento. Uma revogação
-- é uma nova linha com granted = false, nunca um UPDATE/DELETE na linha
-- antiga — mantém histórico auditável, como a LGPD exige.
-- ----------------------------------------------------------------------------

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  consent_type text not null check (
    consent_type in ('terms_of_use', 'image_use', 'parental_authorization')
  ),
  granted boolean not null,
  granted_at timestamptz not null default now(),

  -- Quem registrou este evento. Para 'parental_authorization', deve ser
  -- sempre um líder/admin que verificou a autorização (ex: documento
  -- físico assinado pelos pais) — um menor não pode autoconsentir por si.
  recorded_by uuid references public.profiles (id),
  notes text,

  created_at timestamptz not null default now()
);

create index if not exists user_consents_profile_type_idx
  on public.user_consents (profile_id, consent_type, granted_at desc);

comment on table public.user_consents is
  'Log append-only de consentimentos LGPD por usuário. Nunca editar/apagar uma linha existente — registrar um novo evento.';

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own_or_leadership" on public.user_consents;
create policy "user_consents_select_own_or_leadership"
  on public.user_consents for select
  to authenticated
  using (profile_id = auth.uid() or public.is_leadership(auth.uid()));

-- A própria pessoa só pode registrar os consentimentos que ela mesma tem
-- poder legal de dar (termos de uso, uso de imagem). Autorização parental
-- só pode ser registrada por um líder/administrador (que verificou a
-- autorização real dos pais/responsáveis fora do sistema).
drop policy if exists "user_consents_insert_self_basic" on public.user_consents;
create policy "user_consents_insert_self_basic"
  on public.user_consents for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and consent_type in ('terms_of_use', 'image_use')
  );

drop policy if exists "user_consents_insert_leadership" on public.user_consents;
create policy "user_consents_insert_leadership"
  on public.user_consents for insert
  to authenticated
  with check (public.is_leadership(auth.uid()));

-- Sem policy de UPDATE/DELETE — o log é intencionalmente imutável, para
-- ninguém (nem líder/admin) conseguir apagar ou alterar um consentimento
-- já registrado pela API.

grant select, insert on public.user_consents to authenticated;
