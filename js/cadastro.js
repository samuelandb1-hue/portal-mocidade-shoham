// ============================================================================
// Portal da Mocidade Shoham — cadastro de usuário com consentimento LGPD
//
// ⚠️ MODO MOCK (parcial) — leia antes de mexer aqui:
// A gravação real em `profiles`/`user_consents` exige uma sessão real do
// Supabase Auth (a policy de RLS exige id = auth.uid()). Como o login
// ainda é simulado (ver js/auth.js), NÃO existe sessão real do Supabase
// ainda — então, mesmo com o Supabase configurado, o insert real só vai
// funcionar depois que auth.js for trocado para chamadas reais.
//
// Para permitir testar esta tela hoje, há um fallback mock (localStorage)
// que só é usado quando não existe sessão real do Supabase. Ele pode ser
// apagado assim que o login real estiver funcionando — o caminho real
// (bloco `if (isSupabaseConfigured)`) já está pronto e não deve precisar
// de mudanças nesse momento.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { isMinor } from "./utils.js";
import { getSessionPhone } from "./auth.js";

// profiles mock ficam num objeto { [phone]: profile }, não numa lista —
// por isso não usa js/mock-store.js (feito pra listas simples, usado por
// eventos.js/comunicados.js).
const MOCK_PROFILES_KEY = "shoham_mock_profiles";

function readMockProfiles() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY)) || {};
  } catch {
    return {};
  }
}

function writeMockProfile(phone, profile) {
  const all = readMockProfiles();
  all[phone] = profile;
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(all));
}

function normalizeSupabasePhone(phone) {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

/**
 * Telefone da pessoa autenticada no momento (real ou mock).
 * @returns {Promise<string|null>}
 */
export async function getAuthenticatedPhone() {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user?.phone ? normalizeSupabasePhone(data.user.phone) : null;
  }
  return getSessionPhone();
}

/**
 * Verifica se a pessoa autenticada já tem cadastro (perfil) feito.
 * Usado para pular a tela de cadastro em quem já é cadastrado.
 * @returns {Promise<boolean>}
 */
export async function hasProfile() {
  const phone = await getAuthenticatedPhone();
  if (!phone) return false;

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();
    return !error && !!data;
  }

  return Boolean(readMockProfiles()[phone]);
}

/**
 * @typedef {Object} RegisterInput
 * @property {string} fullName
 * @property {string} birthDate formato ISO (yyyy-mm-dd)
 * @property {string} [email]
 * @property {string} [guardianName]
 * @property {string} [guardianPhone]
 * @property {boolean} termsAccepted
 * @property {boolean} imageUseAccepted
 */

/**
 * Cria o perfil do usuário e registra os consentimentos LGPD aceitos.
 * @param {RegisterInput} input
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function registerProfile(input) {
  const phone = await getAuthenticatedPhone();
  if (!phone) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  if (!input.termsAccepted) {
    return { success: false, error: "É preciso aceitar os Termos de Uso para continuar." };
  }

  const minor = isMinor(input.birthDate);
  if (minor && (!input.guardianName?.trim() || !input.guardianPhone?.trim())) {
    return {
      success: false,
      error: "Como você é menor de idade, é preciso informar o nome e o telefone de um responsável.",
    };
  }

  const profileRow = {
    full_name: input.fullName.trim(),
    phone,
    birth_date: input.birthDate,
    email: input.email?.trim() || null,
    guardian_name: minor ? input.guardianName.trim() : null,
    guardian_phone: minor ? input.guardianPhone.trim() : null,
  };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return { success: false, error: "Não foi possível conectar ao servidor. Verifique sua internet e tente de novo." };
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { success: false, error: "Sessão expirada. Faça login novamente." };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: userData.user.id, ...profileRow });

    if (profileError) {
      return { success: false, error: traduzErroSupabase(profileError.message) };
    }

    const consents = [
      { profile_id: userData.user.id, consent_type: "terms_of_use", granted: true },
    ];
    if (input.imageUseAccepted) {
      consents.push({ profile_id: userData.user.id, consent_type: "image_use", granted: true });
    }

    const { error: consentError } = await supabase.from("user_consents").insert(consents);
    if (consentError) {
      // Perfil já foi criado; o consentimento pode ser reenviado depois pela
      // tela de perfil (a implementar). Não desfazemos o cadastro por isso.
      console.error("Falha ao registrar consentimento:", consentError.message);
    }

    return { success: true };
  }

  // --- modo mock (ver aviso no topo do arquivo) ---
  writeMockProfile(phone, {
    ...profileRow,
    role: "jovem", // autocadastro sempre entra como jovem, igual à regra real de RLS
    consents: {
      terms_of_use: true,
      image_use: Boolean(input.imageUseAccepted),
    },
    createdAt: new Date().toISOString(),
  });
  return { success: true };
}

/**
 * Perfil mock a partir do telefone (chave usada como "id" no modo mock).
 * Usado por outros módulos mock (ex: eventos.js pra mostrar nome de quem
 * confirmou presença) — no modo real isso vem de um JOIN com profiles.
 * @param {string} phone
 * @returns {{ full_name: string, role: string } | null}
 */
export function getMockProfileByPhone(phone) {
  const profile = readMockProfiles()[phone];
  if (!profile) return null;
  return { full_name: profile.full_name, role: profile.role || "jovem" };
}

/**
 * Perfil da pessoa autenticada, se já tiver cadastro. Usado pelo
 * dashboard pra saudação e pra decidir o que mostrar.
 * @returns {Promise<object|null>}
 */
export async function getProfile() {
  const phone = await getAuthenticatedPhone();
  if (!phone) return null;

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role, phone, email, birth_date, guardian_name, guardian_phone")
      .eq("id", userData.user.id)
      .maybeSingle();
    return data || null;
  }

  const profile = readMockProfiles()[phone];
  if (!profile) return null;
  return {
    full_name: profile.full_name,
    role: profile.role || "jovem",
    phone,
    email: profile.email || null,
    birth_date: profile.birth_date,
    guardian_name: profile.guardian_name || null,
    guardian_phone: profile.guardian_phone || null,
  };
}

/**
 * Atualiza os campos editáveis do próprio perfil (nome e e-mail). Não dá
 * pra mudar telefone, nascimento ou role por aqui — telefone tem um fluxo
 * próprio (seção 5.1 do CLAUDE.md, ainda pendente do Twilio real);
 * nascimento e role não são autoeditáveis por regra de negócio.
 * @param {{ fullName: string, email?: string }} input
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateProfile(input) {
  if (!input.fullName?.trim()) {
    return { success: false, error: "O nome não pode ficar vazio." };
  }

  const phone = await getAuthenticatedPhone();
  if (!phone) return { success: false, error: "Sessão expirada. Faça login novamente." };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: input.fullName.trim(), email: input.email?.trim() || null })
      .eq("id", userData.user.id);

    if (error) return { success: false, error: "Não foi possível salvar as alterações." };
    return { success: true };
  }

  const all = readMockProfiles();
  if (!all[phone]) return { success: false, error: "Perfil não encontrado." };
  all[phone].full_name = input.fullName.trim();
  all[phone].email = input.email?.trim() || null;
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(all));
  return { success: true };
}

/**
 * Todos os perfis cadastrados (modo mock). Usado por js/admin.js pra
 * listar usuários — no modo real isso é um SELECT * direto na tabela
 * (RLS já garante que só admin consegue rodar essa query).
 * @returns {Array<{ id: string, full_name: string, phone: string, role: string }>}
 */
export function getAllMockProfiles() {
  const all = readMockProfiles();
  return Object.entries(all).map(([phone, profile]) => ({
    id: phone, // no modo mock, o telefone faz as vezes do id (uuid) real
    full_name: profile.full_name,
    phone,
    role: profile.role || "jovem",
  }));
}

/**
 * Muda o role de um perfil mock pelo telefone (= id no modo mock).
 * @param {string} phone
 * @param {"jovem"|"lider"|"administrador"} role
 */
export function setMockProfileRole(phone, role) {
  const all = readMockProfiles();
  if (!all[phone]) return;
  all[phone].role = role;
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(all));
}

/**
 * ⚠️ SÓ PARA TESTES LOCAIS, nunca chamado por nenhuma tela do produto.
 * Promove o perfil mock do telefone informado a líder/administrador, pra
 * dar pra testar as telas restritas à liderança sem precisar de um
 * Supabase real configurado. Contra um Supabase de verdade isso não tem
 * efeito nenhum — quem manda ali é a RLS do banco (ver migração 0001).
 * @param {string} phone
 * @param {"jovem"|"lider"|"administrador"} role
 */
export function __devSetMockRole(phone, role) {
  setMockProfileRole(phone, role);
}

function traduzErroSupabase(message) {
  if (message.includes("guardian_contact_required_for_minors")) {
    return "Como você é menor de idade, é preciso informar o nome e o telefone de um responsável.";
  }
  if (message.includes("profiles_phone_key") || message.includes("duplicate")) {
    return "Este telefone já está cadastrado.";
  }
  return "Não foi possível concluir o cadastro. Tente novamente em instantes.";
}
