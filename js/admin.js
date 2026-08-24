// ============================================================================
// Portal da Mocidade Shoham — módulo de Administração (gestão de usuários)
//
// Só administradores usam isto (seção 6 do CLAUDE.md: "Gerenciar
// usuários/permissões/líderes" é exclusivo do Administrador — líder não
// entra aqui, só acompanha participantes via leitura). A RLS da migração
// 0004 garante isso no lado do banco; este arquivo replica a checagem
// pro lado da UI não mostrar o que a pessoa não pode usar mesmo.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { getProfile, getAllMockProfiles, setMockProfileRole, getMockProfileByPhone } from "./cadastro.js";
import { MOCK_DELETION_REQUESTS_KEY } from "./mock-store.js";

export const ROLES = ["jovem", "lider", "administrador"];

/** @returns {Promise<boolean>} */
export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === "administrador";
}

/**
 * Líder ou administrador — usado nas solicitações de exclusão, que
 * qualquer um da liderança pode ver/processar (RLS da migração 0005),
 * diferente de gestão de papéis (só admin).
 * @returns {Promise<boolean>}
 */
export async function isLeadership() {
  const profile = await getProfile();
  return profile?.role === "lider" || profile?.role === "administrador";
}

/**
 * Lista todos os perfis cadastrados. Só administrador consegue (RLS no
 * modo real; checagem própria no modo mock).
 * @returns {Promise<Array<{ id: string, full_name: string, phone: string, role: string }>>}
 */
export async function listAllProfiles() {
  if (!(await isAdmin())) return [];

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .order("full_name");
    if (error) {
      console.error("Falha ao carregar usuários:", error.message);
      return [];
    }
    return data || [];
  }

  return getAllMockProfiles().sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Muda o papel de acesso de alguém. Só administrador consegue.
 * @param {string} profileId
 * @param {"jovem"|"lider"|"administrador"} role
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function setUserRole(profileId, role) {
  if (!(await isAdmin())) {
    return { success: false, error: "Só administradores podem alterar o nível de acesso." };
  }
  if (!ROLES.includes(role)) {
    return { success: false, error: "Papel de acesso inválido." };
  }

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (error) return { success: false, error: "Não foi possível alterar o nível de acesso." };
    return { success: true };
  }

  setMockProfileRole(profileId, role);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Solicitações de exclusão de conta (LGPD) — qualquer um da liderança
// (líder ou administrador) pode ver e processar, igual à RLS da
// migração 0005_solicitacao_exclusao.sql.
// ----------------------------------------------------------------------------

/**
 * Solicitações pendentes, com o nome de quem pediu.
 * @returns {Promise<Array<{ id: string, profileId: string, fullName: string, reason: string|null, requestedAt: string }>>}
 */
export async function listPendingDeletionRequests() {
  if (!(await isLeadership())) return [];

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("deletion_requests")
      .select("id, profile_id, reason, requested_at, profiles(full_name)")
      .eq("status", "pendente")
      .order("requested_at");
    if (error) return [];
    return (data || []).map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      fullName: r.profiles?.full_name || "(sem nome)",
      reason: r.reason,
      requestedAt: r.requested_at,
    }));
  }

  const requests = JSON.parse(localStorage.getItem(MOCK_DELETION_REQUESTS_KEY) || "[]");
  return requests
    .filter((r) => r.status === "pendente")
    .map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      fullName: getMockProfileByPhone(r.profile_id)?.full_name || "(sem nome)",
      reason: r.reason,
      requestedAt: r.requested_at,
    }));
}

/**
 * Marca uma solicitação como concluída. NÃO apaga a conta de verdade —
 * isso continua sendo feito manualmente no painel do Supabase (ver
 * supabase/README.md). Esta função só fecha o pedido no app.
 * @param {string} requestId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function markDeletionRequestProcessed(requestId) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem processar solicitações." };
  }

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("deletion_requests")
      .update({ status: "concluida", processed_by: userData.user.id, processed_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) return { success: false, error: "Não foi possível marcar como processada." };
    return { success: true };
  }

  const requests = JSON.parse(localStorage.getItem(MOCK_DELETION_REQUESTS_KEY) || "[]");
  const request = requests.find((r) => r.id === requestId);
  if (!request) return { success: false, error: "Solicitação não encontrada." };
  request.status = "concluida";
  localStorage.setItem(MOCK_DELETION_REQUESTS_KEY, JSON.stringify(requests));
  return { success: true };
}
