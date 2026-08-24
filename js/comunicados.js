// ============================================================================
// Portal da Mocidade Shoham — módulo de Comunicados
//
// Mesmo padrão de js/eventos.js: chamadas reais ao Supabase prontas, com
// fallback mock (localStorage) pra testar antes do backend real.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { getProfile } from "./cadastro.js";
import { readList, writeList, genId } from "./mock-store.js";

const MOCK_ANNOUNCEMENTS_KEY = "shoham_mock_announcements";

export const ANNOUNCEMENT_CATEGORIES = [
  "Aviso",
  "Comunicado",
  "Lembrete",
  "Evento",
  "Estudo",
  "Liderança",
  "Importante",
];

/** @returns {Promise<boolean>} */
export async function isLeadership() {
  const profile = await getProfile();
  return profile?.role === "lider" || profile?.role === "administrador";
}

/**
 * Comunicados ativos (não arquivados), mais recentes primeiro.
 * @returns {Promise<Array<object>>}
 */
export async function listAnnouncements() {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .is("archived_at", null)
      .order("published_at", { ascending: false });
    if (error) {
      console.error("Falha ao carregar comunicados:", error.message);
      return [];
    }
    return data || [];
  }

  return readList(MOCK_ANNOUNCEMENTS_KEY)
    .filter((a) => !a.archived_at)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/**
 * @typedef {Object} AnnouncementInput
 * @property {string} title
 * @property {string} description
 * @property {string} category
 * @property {"normal"|"alta"} [priority]
 */

/**
 * Publica um comunicado. Só líderes/administradores conseguem.
 * @param {AnnouncementInput} input
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function createAnnouncement(input) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem publicar comunicados." };
  }
  if (!input.title?.trim()) {
    return { success: false, error: "Dê um título ao comunicado." };
  }
  if (!input.description?.trim()) {
    return { success: false, error: "Escreva o texto do comunicado." };
  }
  if (!ANNOUNCEMENT_CATEGORIES.includes(input.category)) {
    return { success: false, error: "Escolha uma categoria válida." };
  }

  const row = {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority === "alta" ? "alta" : "normal",
  };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("announcements")
      .insert({ ...row, author_id: userData.user.id });

    if (error) return { success: false, error: "Não foi possível publicar o comunicado." };
    return { success: true };
  }

  const list = readList(MOCK_ANNOUNCEMENTS_KEY);
  list.push({
    ...row,
    id: genId(),
    published_at: new Date().toISOString(),
    archived_at: null,
  });
  writeList(MOCK_ANNOUNCEMENTS_KEY, list);
  return { success: true };
}
