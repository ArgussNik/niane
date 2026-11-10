/* ==========================================================================
   NIANE — supabase.js
   --------------------------------------------------------------------------
   Único lugar do projeto que cria o cliente Supabase.
   Expõe `window.NianeSupabase` (instância reutilizável) e `window.NianeConfig`.

   SOBRE A CHAVE ABAIXO
   A URL do projeto e a chave "anon" (pública) NÃO são segredos: elas vão
   para o navegador de qualquer jeito. Quem protege os dados é o Row Level
   Security (RLS) do banco — veja supabase/migrations/002_rls_policies.sql.

   NUNCA coloque aqui a chave `service_role`, a senha do banco ou qualquer
   token administrativo. Se um dia precisar de uma operação administrativa,
   ela deve rodar em um servidor/Edge Function, jamais neste arquivo.
   ========================================================================== */
(function () {
  'use strict';

  if (window.NianeSupabase) return; // evita inicialização duplicada

  var SUPABASE_URL = 'https://unrzglexlphrytpagswy.supabase.co';
  var SUPABASE_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucnpnbGV4bHBocnl0cGFnc3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzE5MDUsImV4cCI6MjA5ODYwNzkwNX0.pE4M3Mcu-QOAK8wwtMDeEFuvkq6OPEFflDlyPytIQpA';

  window.NianeConfig = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: SUPABASE_PUBLIC_KEY
  };

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[NIANE] Biblioteca supabase-js não carregou (verifique a conexão/CDN).');
    window.NianeSupabase = null;
    return;
  }

  window.NianeSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: {
      persistSession: true,       // sessão sobrevive ao fechar/reabrir a aba
      autoRefreshToken: true,
      detectSessionInUrl: true    // necessário para o link de recuperação de senha
    }
  });
})();
