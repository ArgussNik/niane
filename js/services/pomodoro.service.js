/* ==========================================================================
   NIANE — services/pomodoro.service.js
   Histórico de sessões (tabela pomodoro_sessions). Expõe
   `NianeServices.pomodoro`.
   recordCompleted() é IDEMPOTENTE: o id da sessão é gerado no navegador no
   início da fase, e o insert ignora duplicatas (ON CONFLICT DO NOTHING). Assim,
   várias abas abertas, ou um reenvio após falha de rede, nunca duplicam.
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var TYPES = { focus: 1, short_break: 1, long_break: 1 };

  async function recordCompleted(session) {
    if (!session || !session.id || !TYPES[session.session_type]) {
      throw new U.NianeError('validation', 'Sessão de Pomodoro inválida.');
    }
    var minutes = Math.max(1, Math.min(720, Math.round(Number(session.duration_minutes) || 0)));
    var row = {
      id: session.id,
      duration_minutes: minutes,
      session_type: session.session_type,
      completed: true,
      started_at: new Date(session.started_at).toISOString(),
      finished_at: new Date(session.finished_at).toISOString()
    };
    return U.guard(async function () {
      U.unwrap(await sb.from('pomodoro_sessions').upsert(row, { onConflict: 'id', ignoreDuplicates: true }));
    });
  }

  async function listRecent(limit) {
    return U.guard(async function () {
      return U.unwrap(await sb.from('pomodoro_sessions')
        .select('id, duration_minutes, session_type, completed, started_at, finished_at')
        .order('started_at', { ascending: false }).limit(limit || 50)) || [];
    });
  }

  window.NianeServices.pomodoro = {
    recordCompleted: recordCompleted,
    listRecent: listRecent
  };
})();
