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
import { getProfile, getAllMockProfiles, setMockProfileRole } from "./cadastro.js";

export const ROLES = ["jovem", "lider", "administrador"];

/** @returns {Promise<boolean>} */
export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === "administrador";
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
