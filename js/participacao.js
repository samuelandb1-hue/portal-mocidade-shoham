// ============================================================================
// Portal da Mocidade Shoham — módulo de Participação (gamificação leve)
//
// ⚠️ Regra do CLAUDE.md (seção 8): gamificação é incentivo, nunca deve
// substituir o propósito espiritual, e rankings comparativos entre jovens
// devem ser evitados ou tratados com extremo cuidado.
//
// Por isso este módulo é estritamente PESSOAL: cada um só vê os próprios
// números e conquistas — nunca uma lista comparando jovens entre si, nunca
// um placar público. As mesmas contagens já eram acessíveis via RLS pra
// cada um sobre os próprios dados (event_participants, attendance); isto
// só embala isso de um jeito mais acolhedor que uma tabela crua.
// ============================================================================

import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { getAuthenticatedPhone } from "./cadastro.js";
import { readList, MOCK_EVENT_PARTICIPANTS_KEY, MOCK_ATTENDANCE_KEY } from "./mock-store.js";

/**
 * Conquistas possíveis. Sem "progresso até a próxima" de propósito — a
 * ideia é celebrar o que já aconteceu, não cobrar o que falta.
 */
const BADGES = [
  {
    id: "primeira_presenca",
    metric: "attended",
    min: 1,
    emoji: "🌱",
    label: "Primeira Presença",
    description: "Você esteve presente em um evento da mocidade.",
  },
  {
    id: "presenca_constante",
    metric: "attended",
    min: 5,
    emoji: "🔥",
    label: "Presença Constante",
    description: "Você já esteve presente em 5 ou mais eventos.",
  },
  {
    id: "sempre_por_perto",
    metric: "confirmed",
    min: 10,
    emoji: "🙌",
    label: "Sempre Por Perto",
    description: "Você já confirmou presença em 10 ou mais eventos.",
  },
];

/**
 * Estatísticas e conquistas pessoais de participação. Só da própria
 * pessoa autenticada — este módulo não tem (e não deve ganhar) uma
 * versão que aceite o id de outra pessoa.
 * @returns {Promise<{ confirmedCount: number, attendedCount: number, badges: Array<typeof BADGES[number]> } | null>}
 */
export async function getMyParticipationStats() {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;
    const uid = userData.user.id;

    const [participations, attendance] = await Promise.all([
      supabase.from("event_participants").select("id", { count: "exact", head: true }).eq("profile_id", uid),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", uid)
        .eq("present", true),
    ]);

    return buildStats(participations.count || 0, attendance.count || 0);
  }

  const phone = await getAuthenticatedPhone();
  if (!phone) return null;

  const confirmedCount = readList(MOCK_EVENT_PARTICIPANTS_KEY).filter((p) => p.profile_id === phone).length;
  const attendedCount = readList(MOCK_ATTENDANCE_KEY).filter(
    (a) => a.profile_id === phone && a.present
  ).length;

  return buildStats(confirmedCount, attendedCount);
}

function buildStats(confirmedCount, attendedCount) {
  const values = { confirmed: confirmedCount, attended: attendedCount };
  const badges = BADGES.filter((b) => values[b.metric] >= b.min);
  return { confirmedCount, attendedCount, badges };
}
