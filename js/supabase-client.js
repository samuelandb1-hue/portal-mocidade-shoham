// ============================================================================
// Portal da Mocidade Shoham — inicialização do client Supabase
//
// Importado via CDN (sem npm install), conforme stack definida no CLAUDE.md.
// A `anon key` do Supabase é pública por design (protegida pelas policies de
// RLS no banco), mas fica isolada aqui para facilitar rotação futura.
//
// ⚠️ CONFIGURAÇÃO PENDENTE:
// Substitua SUPABASE_URL e SUPABASE_ANON_KEY pelos valores reais do projeto
// (Supabase → Project Settings → API). Sem isso, nada de autenticação ou
// dados reais vai funcionar — as telas atuais rodam em modo mock.
//
// O carregamento da lib em si (import do CDN) é PREGUIÇOSO: só acontece na
// primeira chamada a getSupabaseClient(), nunca só por importar este
// arquivo. Isso evita que páginas que ainda não usam o Supabase de verdade
// (ex: o login mock) fiquem reféns de uma requisição de rede ao CDN que
// nem é necessária pra elas.
// ============================================================================

const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-ANON-KEY-AQUI";

// Checagem só de string — não depende de rede, então pode ser usada em
// qualquer página sem custo/risco.
export const isSupabaseConfigured =
  !SUPABASE_URL.includes("SEU-PROJETO") &&
  !SUPABASE_ANON_KEY.includes("SUA-ANON-KEY");

let clientPromise = null;

/**
 * Retorna o client Supabase, carregando a lib do CDN sob demanda (uma
 * única vez, cacheada). Retorna null se o projeto ainda não foi
 * configurado ou se o carregamento da lib falhar (ex: sem internet) —
 * quem chamar deve tratar esse caso, nunca assumir que vem preenchido.
 *
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient | null>}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch((err) => {
        console.error("Falha ao carregar o client Supabase:", err);
        clientPromise = null; // permite tentar de novo numa próxima chamada
        return null;
      });
  }

  return clientPromise;
}
