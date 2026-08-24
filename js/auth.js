// ============================================================================
// Portal da Mocidade Shoham — autenticação (login/logout/sessão)
//
// ⚠️ MODO MOCK — leia antes de mexer aqui:
// A autenticação real depende de pré-requisitos externos ainda pendentes
// (seção 5.1 do CLAUDE.md): conta Twilio + Twilio Verify com canal WhatsApp
// habilitado + aprovação do número como WhatsApp Business API pela Meta.
//
// Enquanto isso não estiver pronto, este arquivo simula o envio/validação
// do código OTP localmente (sessionStorage), só para permitir testar a UI
// de login ponta a ponta pelo celular. Nenhum dado aqui é enviado a lugar
// nenhum e nada é persistido como sessão real do Supabase.
//
// Quando os pré-requisitos estiverem prontos, troque o corpo de
// requestOtp/verifyOtp pelas chamadas reais:
//   supabase.auth.signInWithOtp({ phone: e164 })
//   supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" })
// (o Supabase usa o mesmo fluxo "sms" mesmo quando o provedor por trás é o
// Twilio Verify configurado para o canal WhatsApp).
// ============================================================================

import { validatePhone, sleep } from "./utils.js";

const MOCK_OTP_STORAGE_PREFIX = "shoham_mock_otp_";
const MOCK_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutos, igual a um OTP real

/**
 * Solicita o envio do código OTP para o telefone informado.
 * @param {string} rawPhone telefone digitado pelo usuário
 * @returns {Promise<{ success: boolean, e164?: string, error?: string }>}
 */
export async function requestOtp(rawPhone) {
  const { valid, e164 } = validatePhone(rawPhone);

  if (!valid) {
    return {
      success: false,
      error: "Número inválido. Digite um telefone com DDD, ex: (11) 91234-5678.",
    };
  }

  await sleep(600); // simula latência de rede

  const code = String(Math.floor(100000 + Math.random() * 900000));
  sessionStorage.setItem(
    MOCK_OTP_STORAGE_PREFIX + e164,
    JSON.stringify({ code, expiresAt: Date.now() + MOCK_OTP_TTL_MS })
  );

  // Em modo mock não há WhatsApp real enviando nada — o código aparece no
  // console só para permitir testar o fluxo.
  console.info(`[mock OTP] código para ${e164}: ${code}`);

  return { success: true, e164 };
}

/**
 * Valida o código OTP digitado pelo usuário.
 * @param {string} e164 telefone normalizado (retornado por requestOtp)
 * @param {string} code código digitado
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyOtp(e164, code) {
  await sleep(500);

  const raw = sessionStorage.getItem(MOCK_OTP_STORAGE_PREFIX + e164);
  if (!raw) {
    return {
      success: false,
      error: "Código expirado ou não solicitado. Peça um novo código.",
    };
  }

  const { code: expectedCode, expiresAt } = JSON.parse(raw);

  if (Date.now() > expiresAt) {
    sessionStorage.removeItem(MOCK_OTP_STORAGE_PREFIX + e164);
    return { success: false, error: "Código expirado. Peça um novo código." };
  }

  if (code !== expectedCode) {
    return { success: false, error: "Código incorreto. Confira e tente de novo." };
  }

  sessionStorage.removeItem(MOCK_OTP_STORAGE_PREFIX + e164);
  return { success: true };
}
