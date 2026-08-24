-- ============================================================================
-- Portal da Mocidade Shoham
-- Migração 0004 — Restringe gestão de usuários (role) a administrador
--
-- TIPO: ADITIVA (redefine policy/trigger existentes, não apaga dados).
-- Depende da 0001.
--
-- Correção de design: a migração 0001 deixava qualquer líder mudar o
-- `role` de qualquer perfil (inclusive promover alguém a líder/admin).
-- A seção 6 do CLAUDE.md reserva "Gerenciar usuários/permissões/líderes"
-- só pro Administrador — Líder só "acompanha participantes" (leitura,
-- já coberta pela policy de SELECT, que continua igual). Esta migração
-- aperta a regra pra bater com a tabela de permissões do documento.
-- ============================================================================

-- Só administrador pode editar o perfil de OUTRA pessoa (inclusive role).
-- A própria pessoa continua podendo editar o próprio perfil via
-- profiles_update_own (não mexe nisso).
drop policy if exists "profiles_update_leadership" on public.profiles;
create policy "profiles_update_leadership"
  on public.profiles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- A trigger que impede autopromoção também passa a exigir administrador
-- (antes bastava ser líder) pra mudar o role de alguém.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Apenas administradores podem alterar o nível de acesso.';
  end if;
  return new;
end;
$$;
