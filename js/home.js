/* ==========================================================================
   NIANE — home.js (dashboard)
   Todos os números vêm do Supabase (NianeServices.dashboard); nada é
   fictício. O RLS garante que só entram dados do próprio usuário.
   ========================================================================== */
(function () {
  'use strict';

  const U = window.NianeUtils;
  const MODO_KEY = 'niane-home-progress-mode';

  let stats = null;
  let modo = 'listas';
  try { if (localStorage.getItem(MODO_KEY) === 'tarefas') modo = 'tarefas'; } catch (e) { /* usa o padrão */ }

  const $ = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

  function formatPercent(n) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function renderListasSidebar(listas) {
    const container = $('done-list');
    if (!container) return;
    container.textContent = '';

    if (!listas.length) {
      const p = document.createElement('p');
      p.className = 'list-summary-empty';
      p.textContent = 'Nenhuma lista ainda. Crie uma em "My Lists".';
      container.appendChild(p);
      return;
    }

    listas.forEach((lista) => {
      const card = document.createElement('div');
      card.className = 'task-card';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1; min-width:0;';
      const row = document.createElement('div');
      row.className = 'list-card-title-row';
      const title = document.createElement('p');
      title.style.cssText = 'font-weight:600; font-size:0.9rem;';
      title.textContent = lista.title || 'Sem título';
      row.appendChild(title);
      if (lista.complete) {
        const ck = document.createElement('span');
        ck.className = 'check-icon';
        ck.textContent = '✓';
        row.appendChild(ck);
      }
      wrap.appendChild(row);
      const sub = document.createElement('p');
      sub.style.cssText = 'font-size:0.75rem; color:var(--text-muted); margin-top:2px;';
      sub.textContent = (lista.periodLabel ? lista.periodLabel + ' · ' : '') + lista.done + '/' + lista.total + ' tarefas';
      wrap.appendChild(sub);
      card.appendChild(wrap);
      container.appendChild(card);
    });
  }

  function renderProgress() {
    if (!stats) return;
    const feitas = modo === 'tarefas' ? stats.tasksDone : stats.listsDone;
    const total = modo === 'tarefas' ? stats.tasksTotal : stats.listsTotal;
    const pct = total ? Math.min(100, (feitas / total) * 100) : 0;

    setText('percentage-text', formatPercent(pct) + '%');
    setText('percentage-label', modo === 'tarefas' ? 'Progresso de Tarefas' : 'Progresso de Listas');
    setText('task-count', feitas);
    setText('task-count-label', modo === 'tarefas' ? 'TAREFAS PRONTAS' : 'LISTAS PRONTAS');
    const circle = $('outer-circle');
    if (circle) circle.style.background = 'conic-gradient(var(--accent3) ' + pct + '%, #d1e9f2 ' + pct + '%)';
    document.querySelectorAll('.progress-toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === modo);
    });
  }

  function renderStats() {
    if (!stats) return;
    renderProgress();
    renderListasSidebar(stats.lists);

    setText('stat-tarefas-total', stats.tasksTotal);
    setText('stat-tarefas-feitas', stats.tasksDone);
    setText('stat-tarefas-pendentes', stats.tasksPending);
    setText('stat-listas', stats.listsTotal);
    setText('stat-foco-hoje', stats.pomodoroSessionsToday);
    setText('stat-foco-semana', stats.pomodoroMinutesWeek + ' min');

    setText('pomodoro-horas', Math.floor(stats.pomodoroMinutesTotal / 60));
    setText('pomodoro-minutos', stats.pomodoroMinutesTotal % 60);
    setText('pomodoro-sessoes', 'Sessões de foco concluídas: ' + stats.pomodoroSessions);

    const ul = $('recent-notes');
    if (ul) {
      ul.textContent = '';
      if (!stats.recentNotes.length) {
        const li = document.createElement('li');
        li.className = 'home-muted';
        li.textContent = 'Nenhuma nota ainda.';
        ul.appendChild(li);
      }
      stats.recentNotes.slice(0, 3).forEach((n) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = 'notes.html';
        a.textContent = n.title || 'Sem título';
        li.appendChild(a);
        ul.appendChild(li);
      });
    }
  }

  async function carregar() {
    const side = $('done-list');
    if (side) U.renderState(side, 'loading', 'Carregando…');
    try {
      await window.NianeApp.ready;
      stats = await window.NianeServices.dashboard.getStats();
      renderStats();
    } catch (err) {
      if (err && err.kind === 'auth') return; // app.js redireciona para o login
      const e = U.toNianeError(err);
      if (side) U.renderState(side, 'error', e.message, carregar);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = $('progress-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.progress-toggle-btn');
        if (!btn) return;
        modo = btn.dataset.mode;
        try { localStorage.setItem(MODO_KEY, modo); } catch (err) { /* só não lembra a preferência */ }
        renderProgress();
      });
    }

    const el = $('done-list');
    if (el) { // rolagem arrastando com o mouse (comportamento original)
      let isDown = false, startY = 0, startScroll = 0;
      el.addEventListener('mousedown', (e) => { isDown = true; el.classList.add('dragging'); startY = e.pageY; startScroll = el.scrollTop; });
      window.addEventListener('mouseup', () => { isDown = false; el.classList.remove('dragging'); });
      window.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); el.scrollTop = startScroll - (e.pageY - startY); });
    }

    carregar();
    // atualiza ao voltar para a aba (ex.: terminou um Pomodoro em outra página)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && stats) carregar(); });
  });
})();
