// ============================================================================
// Portal da Mocidade Shoham — módulo de Eventos
//
// Mesmo padrão de js/cadastro.js: chamadas reais ao Supabase já prontas
// (bloco `if (isSupabaseConfigured)`), com fallback mock (localStorage)
// pra dar pra testar as telas antes do backend real estar de pé.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { getAuthenticatedPhone, getProfile, getMockProfileByPhone } from "./cadastro.js";
import { readList, writeList, genId } from "./mock-store.js";

const MOCK_EVENTS_KEY = "shoham_mock_events";
const MOCK_PARTICIPANTS_KEY = "shoham_mock_event_participants";
const MOCK_ATTENDANCE_KEY = "shoham_mock_attendance";

export const EVENT_CATEGORIES = [
  "Culto",
  "Encontro de Jovens",
  "Congresso",
  "Estudo",
  "Retiro",
  "Ação Social",
  "Ensaio",
  "Reunião",
  "Evento Especial",
];

/** @returns {Promise<boolean>} se a pessoa autenticada é líder/administrador */
export async function isLeadership() {
  const profile = await getProfile();
  return profile?.role === "lider" || profile?.role === "administrador";
}

/**
 * Lista de eventos, mais próximos primeiro.
 * @returns {Promise<Array<object>>}
 */
export async function listEvents() {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error) {
      console.error("Falha ao carregar eventos:", error.message);
      return [];
    }
    return data || [];
  }

  return readList(MOCK_EVENTS_KEY).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getEvent(id) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    return data || null;
  }

  return readList(MOCK_EVENTS_KEY).find((e) => e.id === id) || null;
}

/**
 * @typedef {Object} EventInput
 * @property {string} title
 * @property {string} category
 * @property {string} [description]
 * @property {string} [location]
 * @property {string} startsAt ISO datetime
 * @property {string} [endsAt] ISO datetime
 */

/**
 * Cria um evento. Só líderes/administradores conseguem (RLS garante isso
 * no modo real; no mock, checamos aqui mesmo pra tela se comportar igual).
 * @param {EventInput} input
 * @returns {Promise<{ success: boolean, error?: string, id?: string }>}
 */
export async function createEvent(input) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem criar eventos." };
  }
  if (!input.title?.trim()) {
    return { success: false, error: "Dê um título ao evento." };
  }
  if (!EVENT_CATEGORIES.includes(input.category)) {
    return { success: false, error: "Escolha uma categoria válida." };
  }
  if (!input.startsAt) {
    return { success: false, error: "Informe a data e hora do evento." };
  }
  if (input.endsAt && input.endsAt < input.startsAt) {
    return { success: false, error: "O fim do evento não pode ser antes do início." };
  }

  const row = {
    title: input.title.trim(),
    category: input.category,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
    status: "ativo",
  };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { data, error } = await supabase
      .from("events")
      .insert({ ...row, created_by: userData.user.id })
      .select("id")
      .single();

    if (error) return { success: false, error: "Não foi possível criar o evento. Tente de novo." };
    return { success: true, id: data.id };
  }

  const phone = await getAuthenticatedPhone();
  const events = readList(MOCK_EVENTS_KEY);
  const id = genId();
  events.push({ ...row, id, created_by: phone, created_at: new Date().toISOString() });
  writeList(MOCK_EVENTS_KEY, events);
  return { success: true, id };
}

/**
 * Cancela um evento (nunca apaga — vira status "cancelado").
 * @param {string} id
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function cancelEvent(id) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem cancelar eventos." };
  }

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { error } = await supabase.from("events").update({ status: "cancelado" }).eq("id", id);
    if (error) return { success: false, error: "Não foi possível cancelar o evento." };
    return { success: true };
  }

  const events = readList(MOCK_EVENTS_KEY);
  const event = events.find((e) => e.id === id);
  if (!event) return { success: false, error: "Evento não encontrado." };
  event.status = "cancelado";
  writeList(MOCK_EVENTS_KEY, events);
  return { success: true };
}

/** @returns {Promise<boolean>} se a pessoa autenticada já confirmou presença no evento */
export async function hasConfirmedPresence(eventId) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;
    const { data, error } = await supabase.rpc("has_confirmed_presence", { p_event_id: eventId });
    return !error && Boolean(data);
  }

  const phone = await getAuthenticatedPhone();
  if (!phone) return false;
  return readList(MOCK_PARTICIPANTS_KEY).some((p) => p.event_id === eventId && p.profile_id === phone);
}

/** @returns {Promise<number>} quantas pessoas confirmaram presença (sem expor quem são) */
export async function getParticipantCount(eventId) {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return 0;
    const { data, error } = await supabase.rpc("event_participant_count", { p_event_id: eventId });
    return error ? 0 : Number(data) || 0;
  }

  return readList(MOCK_PARTICIPANTS_KEY).filter((p) => p.event_id === eventId).length;
}

/** @returns {Promise<{ success: boolean, error?: string }>} */
export async function confirmPresence(eventId) {
  const phone = await getAuthenticatedPhone();
  if (!phone) return { success: false, error: "Sessão expirada. Faça login novamente." };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("event_participants")
      .insert({ event_id: eventId, profile_id: userData.user.id });

    if (error) return { success: false, error: "Não foi possível confirmar presença." };
    return { success: true };
  }

  const participants = readList(MOCK_PARTICIPANTS_KEY);
  if (participants.some((p) => p.event_id === eventId && p.profile_id === phone)) {
    return { success: true }; // já confirmado, idempotente
  }
  participants.push({ event_id: eventId, profile_id: phone });
  writeList(MOCK_PARTICIPANTS_KEY, participants);
  return { success: true };
}

/** @returns {Promise<{ success: boolean, error?: string }>} */
export async function cancelPresence(eventId) {
  const phone = await getAuthenticatedPhone();
  if (!phone) return { success: false, error: "Sessão expirada. Faça login novamente." };

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("event_participants")
      .delete()
      .eq("event_id", eventId)
      .eq("profile_id", userData.user.id);

    if (error) return { success: false, error: "Não foi possível desmarcar presença." };
    return { success: true };
  }

  const participants = readList(MOCK_PARTICIPANTS_KEY).filter(
    (p) => !(p.event_id === eventId && p.profile_id === phone)
  );
  writeList(MOCK_PARTICIPANTS_KEY, participants);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Presença de fato no evento (attendance) — diferente da confirmação
// prévia acima. Só liderança usa isto, pra registrar quem realmente
// apareceu (seção 8 do CLAUDE.md, "Presença vinculada a Eventos").
// ----------------------------------------------------------------------------

/**
 * Lista de quem confirmou presença no evento, com nome e status de
 * presença (marcado pela liderança), pra montar a tela de "tirar
 * presença". Só liderança consegue chamar (RLS bloqueia o resto).
 * @param {string} eventId
 * @returns {Promise<Array<{ profileId: string, fullName: string, present: boolean|null }>>}
 */
export async function listConfirmedParticipants(eventId) {
  if (!(await isLeadership())) return [];

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];

    const { data: participants, error } = await supabase
      .from("event_participants")
      .select("profile_id, profiles(full_name)")
      .eq("event_id", eventId);
    if (error || !participants) return [];

    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("profile_id, present")
      .eq("event_id", eventId);
    const attendanceMap = new Map((attendanceRows || []).map((a) => [a.profile_id, a.present]));

    return participants.map((p) => ({
      profileId: p.profile_id,
      fullName: p.profiles?.full_name || "(sem nome)",
      present: attendanceMap.has(p.profile_id) ? attendanceMap.get(p.profile_id) : null,
    }));
  }

  const participants = readList(MOCK_PARTICIPANTS_KEY).filter((p) => p.event_id === eventId);
  const attendance = readList(MOCK_ATTENDANCE_KEY).filter((a) => a.event_id === eventId);
  const attendanceMap = new Map(attendance.map((a) => [a.profile_id, a.present]));

  return participants.map((p) => ({
    profileId: p.profile_id,
    fullName: getMockProfileByPhone(p.profile_id)?.full_name || "(sem nome)",
    present: attendanceMap.has(p.profile_id) ? attendanceMap.get(p.profile_id) : null,
  }));
}

/**
 * Registra se a pessoa esteve presente ou não. Só liderança.
 * @param {string} eventId
 * @param {string} profileId
 * @param {boolean} present
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function markAttendance(eventId, profileId, present) {
  if (!(await isLeadership())) {
    return { success: false, error: "Só líderes ou administradores podem registrar presença." };
  }

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: false, error: "Sem conexão com o servidor." };
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Sessão expirada." };

    const { error } = await supabase
      .from("attendance")
      .upsert(
        { event_id: eventId, profile_id: profileId, present, marked_by: userData.user.id },
        { onConflict: "event_id,profile_id" }
      );

    if (error) return { success: false, error: "Não foi possível registrar a presença." };
    return { success: true };
  }

  const attendance = readList(MOCK_ATTENDANCE_KEY);
  const existing = attendance.find((a) => a.event_id === eventId && a.profile_id === profileId);
  if (existing) {
    existing.present = present;
  } else {
    attendance.push({ event_id: eventId, profile_id: profileId, present });
  }
  writeList(MOCK_ATTENDANCE_KEY, attendance);
  return { success: true };
}

/**
 * Resumo agregado (confirmados x presentes) de um evento, só liderança.
 * @param {string} eventId
 * @returns {Promise<{ confirmedCount: number, attendedCount: number } | null>}
 */
export async function getAttendanceSummary(eventId) {
  if (!(await isLeadership())) return null;

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .rpc("event_attendance_summary", { p_event_id: eventId })
      .maybeSingle();
    if (error || !data) return null; // sem linha = sem permissão (ver supabase/README.md)
    return { confirmedCount: Number(data.confirmed_count), attendedCount: Number(data.attended_count) };
  }

  const confirmedCount = readList(MOCK_PARTICIPANTS_KEY).filter((p) => p.event_id === eventId).length;
  const attendedCount = readList(MOCK_ATTENDANCE_KEY).filter(
    (a) => a.event_id === eventId && a.present
  ).length;
  return { confirmedCount, attendedCount };
}
