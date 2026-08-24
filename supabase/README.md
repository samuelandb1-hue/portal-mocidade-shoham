# Migrações do banco — Portal da Mocidade Shoham

Este projeto não usa o Supabase CLI (exigiria Node/npm, proibido pela stack —
ver seção 5 do `CLAUDE.md`). As migrações aqui são arquivos `.sql` simples,
pensados para colar direto no **SQL Editor** do painel do Supabase.

## Como aplicar uma migração

1. Abra o [painel do Supabase](https://supabase.com/dashboard) do projeto.
2. Vá em **SQL Editor → New query**.
3. Cole o conteúdo do arquivo `.sql` inteiro.
4. Clique em **Run**.
5. Confira no final da execução se não houve erro.

Aplique os arquivos **em ordem** (`0001_...`, `0002_...`, ...). Cada um indica
no topo se é **aditivo** (só cria/soma, seguro) ou **destrutivo** (remove ou
altera dados existentes — sempre peço confirmação antes de entregar um
destrutivo, conforme regra 4 da seção 12 do `CLAUDE.md`).

## Migrações aplicadas

| Arquivo | Tipo | O que faz |
| :--- | :--- | :--- |
| `0001_init_auth_foundation.sql` | Aditiva | Cria o enum `user_role`, a tabela `profiles` (com RLS), as funções auxiliares `is_leadership`/`is_admin`, e a tabela `user_consents` (log de consentimento LGPD, com RLS). |
| `0002_eventos_comunicados.sql` | Aditiva | Cria `events` (líder cria/edita/cancela, todo mundo vê), `event_participants` (confirmação de presença — cada um só vê a própria, liderança vê todas; contagem agregada disponível a qualquer um via função, sem expor nomes) e `announcements` (comunicados — liderança publica, todo mundo lê). Depende da 0001. |
| `0003_estudos_presenca.sql` | Aditiva | Cria `studies` (estudos/materiais — liderança publica, todo mundo lê; **conteúdo real é responsabilidade da liderança, nunca gerado por IA**), `attendance` (presença de fato no evento, só liderança registra — diferente de `event_participants`, que é a confirmação prévia) e a função `event_attendance_summary` (indicador agregado por evento, só pra liderança). Depende da 0001 e da 0002. |
| `0004_restringe_gestao_usuarios_a_admin.sql` | Aditiva | Corrige a policy de UPDATE de `profiles` e a trigger anti-autopromoção: mudar o `role` de alguém passa a exigir `administrador`, não basta ser `lider`. Depende da 0001. |
| `0005_solicitacao_exclusao.sql` | Aditiva | Cria `deletion_requests` (direito de exclusão da LGPD): a pessoa solicita, a liderança vê e marca como processada. A exclusão de fato (apagar `auth.users`) continua sendo manual, no painel do Supabase — exige a Admin API/service_role, que nunca deve rodar no navegador. Depende da 0001. |

## Depois de aplicar a `0001`

Confirme manualmente no painel (Authentication → Policies, ou testando pela
própria API) que:

- [ ] RLS está **habilitada** em `profiles` e `user_consents` (o painel mostra
      um cadeado/aviso se estiver desligada).
- [ ] Um usuário autenticado só consegue ler/editar o **próprio** perfil.
- [ ] Um cadastro de menor de 18 anos **falha** sem `guardian_name`/`guardian_phone`
      preenchidos (teste inserindo uma linha de teste com `birth_date` recente).
- [ ] Ninguém consegue se autopromover a `lider`/`administrador` editando o
      próprio perfil (tentar mudar `role` numa linha própria deve dar erro).

Essas checagens não dá pra eu validar sozinho sem acesso ao seu projeto
Supabase — preciso que você confirme por lá.

## Depois de aplicar a `0002`

- [ ] Um `jovem` **não consegue** criar/editar/cancelar eventos nem publicar
      comunicados (só `lider`/`administrador` conseguem).
- [ ] Um `jovem` consegue confirmar presença num evento, mas **não** consegue
      ver a lista de quem mais confirmou (só a própria confirmação e a
      contagem total).
- [ ] Um `lider` consegue ver a lista completa de confirmados de um evento.

## Depois de aplicar a `0003`

- [ ] Um `jovem` **não consegue** publicar estudos nem marcar a própria
      presença (`attendance`) — só `lider`/`administrador`.
- [ ] Um `jovem` consegue ver a própria presença, mas não a de outros.
- [ ] `event_attendance_summary(event_id)` chamado por um `jovem` retorna
      **0 linhas** (não um erro) — é assim mesmo, por design (sem
      permissão = sem resultado). O código que chama essa função precisa
      tratar "nenhuma linha" como "sem acesso", não como erro.

## Depois de aplicar a `0004`

- [ ] Um `lider` (não `administrador`) **não consegue** promover ninguém
      a líder/administrador — só o `administrador` consegue.
- [ ] Um `lider` continua conseguindo criar eventos, publicar
      comunicados/estudos e registrar presença normalmente (nada disso
      foi afetado).
- [ ] **Você precisa promover manualmente o primeiro `administrador`** via
      SQL Editor (`UPDATE public.profiles SET role = 'administrador' WHERE id = '...'`)
      — igual ao primeiro líder, ninguém pode se autopromover.

## Depois de aplicar a `0005`

- [ ] Um `jovem` consegue solicitar a própria exclusão, mas não em nome
      de outra pessoa.
- [ ] Uma segunda solicitação enquanto já existe uma pendente é
      bloqueada (`deletion_requests_one_pending_per_profile`).
- [ ] **Processo manual pendente de definir com a liderança**: quando uma
      solicitação chegar (visível em `admin/usuarios.html`), alguém com
      acesso ao painel do Supabase precisa, à mão: (1) excluir a pessoa
      de `auth.users` (Authentication → Users) — isso já apaga o
      `profiles` junto, por causa do `on delete cascade`; (2) marcar a
      solicitação como `concluida`. Não existe automação pra isso ainda
      porque exigiria a service_role key rodando em algum lugar seguro
      fora do navegador (ex: uma Edge Function) — avaliar se vale a pena
      quando o volume de pedidos justificar.
