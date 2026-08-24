// ============================================================================
// Portal da Mocidade Shoham — módulo de Estudos e Materiais
//
// ⚠️ Regra fundamental (seção 8 do CLAUDE.md): este arquivo NUNCA gera ou
// completa conteúdo bíblico/estudos por conta própria. Só oferece o
// formulário — o texto real é digitado pela liderança na tela.
//
// Mesmo padrão de js/eventos.js e js/comunicados.js: chamadas reais ao
// Supabase prontas, com fallback mock (localStorage) pra testar hoje.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { getProfile } from "./cadastro.js";
import { readList, writeList, genId } from "./mock-store.js";

const MOCK_STUDIES_KEY = "shoham_mock_studies";

export const STUDY_CATEGORIES = [
  "Bíblia",
  "Vida Cristã",
  "Liderança",
  "Evangelismo",
  "Relacionamentos",
  "Família",
  "Propósito",
  "Discipulado",
  "Caráter",
  "Serviço",
  "Fé",
];

export const CONTENT_TYPES = [
  { value: "texto", label: "Texto" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Vídeo" },
  { value: "material_complementar", label: "Material complementar" },
];

/** @returns {Promise<boolean>} */
export async function isLeadership() {
  const profile = await getProfile();
  return profile?.role === "lider" || profile?.role === "administrador";
}

/**
 * Estudos ativos (não arquivados), mais recentes primeiro.
 * @returns {Promise<Array<object>>}
 */
export async function listStudies() {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("studies")
      .select("*")
      .is("archived_at", null)
      .order("published_at", { ascending: false });
    if (error) {
      console.error("Falha ao carregar estudos:", error.message);
      return [];
    }
    return data || [];
  }

  return readList(MOCK_STUDIES_KEY)
    .filter((s) => !s.archived_at)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getStudy(id) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.from("studies").select("*").eq("id", id).maybeSingle();
    return data || null;
  }

  return readList(MOCK_STUDIES_KEY).find((s) => s.id === id) || null;
}

/**
 * @typedef {Object} StudyInput
 * @property {string} title
 * @property {string} category
 * @property {string} contentType "texto"|"pdf"|"video"|"material_complementar"
 * @property {string} [description]
 * @property {string} [bodyText] usado quando contentType === "texto"
 * @property {string} [resourceUrl] usado nos demais tipos
 */

/**
 * Publica um estudo. Só líderes/administradores conseguem.
 * @param {StudyInput} input
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function createStudy(input) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem publicar estudos." };
  }
  if (!input.title?.trim()) {
    return { success: false, error: "Dê um título ao estudo." };
  }
  if (!STUDY_CATEGORIES.includes(input.category)) {
    return { success: false, error: "Escolha uma categoria válida." };
  }
  if (!CONTENT_TYPES.some((t) => t.value === input.contentType)) {
    return { success: false, error: "Escolha um tipo de conteúdo válido." };
  }
  if (input.contentType === "texto" && !input.bodyText?.trim()) {
    return { success: false, error: "Escreva o texto do estudo." };
  }
  if (input.contentType !== "texto" && !input.resourceUrl?.trim()) {
    return { success: false, error: "Informe o link do material." };
  }

  const row = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    content_type: input.contentType,
    body_text: input.contentType === "texto" ? input.bodyText.trim() : null,
    resource_url: input.contentType !== "texto" ? input.resourceUrl.trim() : null,
  };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase.from("studies").insert({ ...row, author_id: userData.user.id });
    if (error) return { success: false, error: "Não foi possível publicar o estudo." };
    return { success: true };
  }

  const list = readList(MOCK_STUDIES_KEY);
  list.push({ ...row, id: genId(), published_at: new Date().toISOString(), archived_at: null });
  writeList(MOCK_STUDIES_KEY, list);
  return { success: true };
}
