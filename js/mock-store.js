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

export function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
