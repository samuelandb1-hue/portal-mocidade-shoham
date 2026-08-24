// ============================================================================
// Portal da Mocidade Shoham — armazenamento local para os fluxos MOCK
//
// Usado só enquanto o Supabase não está configurado (ver isSupabaseConfigured
// em supabase-client.js). Reúne o básico de ler/escrever listas no
// localStorage, pra não duplicar essa lógica em cada módulo (auth, cadastro,
// eventos, comunicados...). Nada aqui é gravado em rede — fica só no
// navegador de quem está testando.
// ============================================================================

export function readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

// Chaves de storage compartilhadas entre módulos (evita import circular
// entre eventos.js e cadastro.js — exportMyData() em cadastro.js precisa
// ler os mesmos dados de presença/confirmação que eventos.js escreve).
export const MOCK_EVENT_PARTICIPANTS_KEY = "shoham_mock_event_participants";
export const MOCK_ATTENDANCE_KEY = "shoham_mock_attendance";
export const MOCK_DELETION_REQUESTS_KEY = "shoham_mock_deletion_requests";

export function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
