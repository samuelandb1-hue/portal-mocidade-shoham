// ============================================================================
// Portal da Mocidade Shoham — inicialização única do client Supabase
//
// Importado via CDN (sem npm install), conforme stack definida no CLAUDE.md.
// A `anon key` do Supabase é pública por design (protegida pelas policies de
// RLS no banco), mas fica isolada aqui para facilitar rotação futura.
//
// ⚠️ CONFIGURAÇÃO PENDENTE:
// Substitua SUPABASE_URL e SUPABASE_ANON_KEY pelos valores reais do projeto
// (Supabase → Project Settings → API). Sem isso, nada de autenticação ou
// dados reais vai funcionar — as telas atuais rodam em modo mock.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-ANON-KEY-AQUI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Ajuda a identificar rapidamente, em telas de erro/debug, se o projeto
// ainda está com as credenciais placeholder.
export const isSupabaseConfigured =
  !SUPABASE_URL.includes("SEU-PROJETO") &&
  !SUPABASE_ANON_KEY.includes("SUA-ANON-KEY");
