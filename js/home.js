(function () {
  'use strict';

  const LISTAS_KEY = 'meuGerenciadorTarefas';
  const MODO_KEY = 'niane-home-progress-mode';
  const POMODORO_TOTAL_KEY = 'niane-pomodoro-total-seconds';

  const DEFAULT_LISTAS = [
    {
      titulo: 'Lista 1',
      periodo: 'Seg - quarta',
      tarefas: [
        { texto: 'Comer arroz, feijão e carne', concluida: false, data: '', hora: '', notes: '', priority: '' },
        { texto: 'Estudar às 10 horas.', concluida: false, data: '', hora: '10:00', notes: '', priority: 'alta' }
      ]
    }
  ];

  function getListas() {
    try {
      const raw = JSON.parse(localStorage.getItem(LISTAS_KEY));
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return DEFAULT_LISTAS;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function listaCompleta(lista) {
    return !!(lista.tarefas && lista.tarefas.length && lista.tarefas.every(t => t.concluida));
  }

  function formatPercent(n) {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function statsListas(listas) {
    const total = listas.length;
    const feitas = listas.filter(listaCompleta).length;
    return { feitas, total, pct: total ? (feitas / total) * 100 : 0 };
  }

  function statsTarefas(listas) {
    let total = 0;
    let feitas = 0;
    listas.forEach((l) => (l.tarefas || []).forEach((t) => {
      total += 1;
      if (t.concluida) feitas += 1;
    }));
    return { feitas, total, pct: total ? (feitas / total) * 100 : 0 };
  }

  function renderListasSidebar(listas) {
    const container = document.getElementById('done-list');
    if (!container) return;
    container.innerHTML = '';

    if (!listas.length) {
      container.innerHTML = '<p class="list-summary-empty">Nenhuma lista ainda.<br>Crie uma em "My Lists".</p>';
      return;
    }

    listas.forEach((lista) => {
      const completa = listaCompleta(lista);
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div class="list-card-title-row">
            <p style="font-weight:600; font-size:0.9rem;">${escapeHtml(lista.titulo || 'Sem título')}</p>
            ${completa ? '<span class="check-icon">✓</span>' : ''}
          </div>
          ${lista.periodo ? `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(lista.periodo)}</p>` : ''}
        </div>
      `;
      container.appendChild(card);
    });
  }

  function getPomodoroTotalSeconds() {
    const raw = Number(localStorage.getItem(POMODORO_TOTAL_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function updatePomodoroDisplay() {
    const totalSegundos = getPomodoroTotalSeconds();
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const horasEl = document.getElementById('pomodoro-horas');
    const minutosEl = document.getElementById('pomodoro-minutos');
    if (horasEl) horasEl.innerText = horas;
    if (minutosEl) minutosEl.innerText = minutos;
  }

  let modo = localStorage.getItem(MODO_KEY) === 'tarefas' ? 'tarefas' : 'listas';

  function updateProgress() {
    const listas = getListas();
    renderListasSidebar(listas);

    const stats = modo === 'tarefas' ? statsTarefas(listas) : statsListas(listas);
    const pct = Math.min(Math.max(stats.pct, 0), 100);

    const percentageText = document.getElementById('percentage-text');
    const percentageLabel = document.getElementById('percentage-label');
    const taskCount = document.getElementById('task-count');
    const taskCountLabel = document.getElementById('task-count-label');
    const circle = document.getElementById('outer-circle');

    if (percentageText) percentageText.innerText = formatPercent(pct) + '%';
    if (percentageLabel) percentageLabel.innerText = modo === 'tarefas' ? 'Progresso de Tarefas' : 'Progresso de Listas';
    if (taskCount) taskCount.innerText = stats.feitas;
    if (taskCountLabel) taskCountLabel.innerText = modo === 'tarefas' ? 'TAREFAS PRONTAS' : 'LISTAS PRONTAS';
    if (circle) circle.style.background = `conic-gradient(var(--accent3) ${pct}%, #d1e9f2 ${pct}%)`;

    document.querySelectorAll('.progress-toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === modo);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('progress-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.progress-toggle-btn');
        if (!btn) return;
        modo = btn.dataset.mode;
        try { localStorage.setItem(MODO_KEY, modo); } catch (err) {}
        updateProgress();
      });
    }

    const el = document.getElementById('done-list');
    if (el) {
      let isDown = false;
      let startY = 0;
      let startScroll = 0;
      el.addEventListener('mousedown', (e) => {
        isDown = true;
        el.classList.add('dragging');
        startY = e.pageY;
        startScroll = el.scrollTop;
      });
      window.addEventListener('mouseup', () => {
        isDown = false;
        el.classList.remove('dragging');
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        el.scrollTop = startScroll - (e.pageY - startY);
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === LISTAS_KEY) updateProgress();
      if (e.key === POMODORO_TOTAL_KEY) updatePomodoroDisplay();
    });

    updateProgress();
    updatePomodoroDisplay();
  });
})();
