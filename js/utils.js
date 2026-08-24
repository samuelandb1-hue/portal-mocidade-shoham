// ============================================================================
// Portal da Mocidade Shoham — funções compartilhadas
// Lógica repetida entre páginas deve viver aqui, nunca duplicada arquivo a
// arquivo (regra da seção 11 do CLAUDE.md).
// ============================================================================

/**
 * Normaliza um telefone brasileiro digitado em qualquer formato comum
 * ("(11) 91234-5678", "11 91234 5678", "5511912345678"...) para E.164
 * (+5511912345678), formato exigido pelo Supabase Phone Auth.
 *
 * @param {string} rawInput
 * @returns {string|null} telefone em E.164, ou null se inválido
 */
export function normalizePhoneToE164(rawInput) {
  if (!rawInput) return null;

  const digits = rawInput.replace(/\D/g, "");
  if (!digits) return null;

  // Já veio com DDI 55
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  // DDD (2 dígitos) + número (8 ou 9 dígitos) => celular BR válido
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return null;
}

/**
 * Validação amigável de telefone para uso em formulários.
 * @param {string} rawInput
 * @returns {{ valid: boolean, e164: string|null }}
 */
export function validatePhone(rawInput) {
  const e164 = normalizePhoneToE164(rawInput);
  return { valid: e164 !== null, e164 };
}

/**
 * Formata uma data ISO para o padrão brasileiro (dd/mm/aaaa).
 * @param {string|Date} date
 */
export function formatDateBR(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

/**
 * Aguarda N milissegundos. Usado para simular latência em fluxos mock.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
