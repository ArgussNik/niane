/* ==========================================================================
   NIANE — services/dashboard.service.js
   Números reais da Home, calculados a partir do banco (RLS garante que só
   entram dados do próprio usuário). Expõe `NianeServices.dashboard`.
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  function startOfDayIso(offsetDays) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (offsetDays || 0));
    return d.toISOString();
  }

  async function getStats() {
    return U.guard(async function () {
      var results = await Promise.all([
        sb.from('lists').select('id, title, period_label, position, created_at')
          .order('position', { ascending: true }).order('created_at', { ascending: true }),
        sb.from('tasks').select('id, list_id, is_completed'),
        sb.from('notes').select('id, title, updated_at').order('updated_at', { ascending: false }).limit(5),
        sb.from('pomodoro_sessions').select('duration_minutes, started_at')
          .eq('completed', true).eq('session_type', 'focus')
      ]);
      var lists = U.unwrap(results[0]) || [];
      var tasks = U.unwrap(results[1]) || [];
      var notes = U.unwrap(results[2]) || [];
      var focus = U.unwrap(results[3]) || [];

      var perList = {};
      tasks.forEach(function (t) {
        var s = perList[t.list_id] || (perList[t.list_id] = { total: 0, done: 0 });
        s.total += 1; if (t.is_completed) s.done += 1;
      });
      var listsOut = lists.map(function (l) {
        var s = perList[l.id] || { total: 0, done: 0 };
        return { id: l.id, title: l.title, periodLabel: l.period_label, total: s.total, done: s.done,
                 complete: s.total > 0 && s.done === s.total };
      });

      var doneTasks = tasks.filter(function (t) { return t.is_completed; }).length;
      var minutesTotal = focus.reduce(function (a, s) { return a + s.duration_minutes; }, 0);
      var today = startOfDayIso(0), week = startOfDayIso(6);
      var sessionsToday = focus.filter(function (s) { return s.started_at >= today; }).length;
      var minutesWeek = focus.filter(function (s) { return s.started_at >= week; })
        .reduce(function (a, s) { return a + s.duration_minutes; }, 0);

      return {
        lists: listsOut,
        listsTotal: listsOut.length,
        listsDone: listsOut.filter(function (l) { return l.complete; }).length,
        tasksTotal: tasks.length,
        tasksDone: doneTasks,
        tasksPending: tasks.length - doneTasks,
        recentNotes: notes,
        pomodoroSessions: focus.length,
        pomodoroSessionsToday: sessionsToday,
        pomodoroMinutesTotal: minutesTotal,
        pomodoroMinutesWeek: minutesWeek
      };
    });
  }

  window.NianeServices.dashboard = { getStats: getStats };
})();
