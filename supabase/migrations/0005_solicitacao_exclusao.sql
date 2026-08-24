-- ============================================================================
-- Portal da Mocidade Shoham
-- Migração 0005 — Solicitação de exclusão de conta (direitos do titular, LGPD)
--
-- TIPO: ADITIVA. Depende da 0001.
--
-- Por que "solicitação" e não exclusão direta: apagar de verdade uma
-- conta (auth.users) exige a Admin API do Supabase (service_role key),
-- que NUNCA deve rodar no client/navegador — só server-side. Então o
-- fluxo aqui é: o titular pede, um administrador processa manualmente
-- (painel do Supabase ou uma função server-side futura). Isso ainda
-- cumpre o direito de exclusão da LGPD (seção 9 do CLAUDE.md): a pessoa
-- consegue solicitar, e a solicitação fica registrada e visível.
-- ============================================================================

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  reason text,

  requested_at timestamptz not null default now(),
  processed_by uuid references public.profiles (id),
  processed_at timestamptz,
  notes text
);

-- Só uma solicitação PENDENTE por pessoa ao mesmo tempo (um índice único
-- comum bloquearia até duas "concluída" no histórico, o que não faz
-- sentido — por isso é parcial, só sobre status = 'pendente').
create unique index if not exists deletion_requests_one_pending_per_profile
  on public.deletion_requests (profile_id)
  where status = 'pendente';

create index if not exists deletion_requests_status_idx on public.deletion_requests (status);

alter table public.deletion_requests enable row level security;

drop policy if exists "deletion_requests_select_own_or_leadership" on public.deletion_requests;
create policy "deletion_requests_select_own_or_leadership"
  on public.deletion_requests for select
  to authenticated
  using (profile_id = auth.uid() or public.is_leadership(auth.uid()));

-- A própria pessoa só cria pedido pra si mesma.
drop policy if exists "deletion_requests_insert_self" on public.deletion_requests;
create policy "deletion_requests_insert_self"
  on public.deletion_requests for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Só liderança marca como processada/cancelada (e só administrador de
-- fato executa a exclusão, fora do app, no painel do Supabase).
drop policy if exists "deletion_requests_update_leadership" on public.deletion_requests;
create policy "deletion_requests_update_leadership"
  on public.deletion_requests for update
  to authenticated
  using (public.is_leadership(auth.uid()))
  with check (public.is_leadership(auth.uid()));

grant select, insert, update on public.deletion_requests to authenticated;
