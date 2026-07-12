(function () {
  'use strict';

  let minhasListas = JSON.parse(localStorage.getItem('meuGerenciadorTarefas')) || [
    {
      titulo: 'Lista 1',
      periodo: 'Seg - quarta',
      tarefas: [
        { texto: 'Comer arroz, feijão e carne', concluida: false, data: '', hora: '', notes: '', priority: '' },
        { texto: 'Estudar às 10 horas.', concluida: false, data: '', hora: '10:00', notes: '', priority: 'alta' }
      ]
    }
  ];

  let editingList = -1;
  let editingTask = -1;
  let ctxListIdx = -1;

  function salvar() {
    localStorage.setItem('meuGerenciadorTarefas', JSON.stringify(minhasListas));
  }

  function formatDateTime(data, hora) {
    const parts = [];
    if (data) {
      const d = new Date(data + 'T00:00:00');
      parts.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
    }
    if (hora) parts.push(hora);
    return parts.join(' · ');
  }

  function render() {
    const rowEl = document.getElementById('listsRow');
    if (!rowEl) return;
    rowEl.innerHTML = '';

    minhasListas.forEach((lista, listaIdx) => {
      const block = document.createElement('div');
      block.className = 'list-block';

      const h2 = document.createElement('h2');
      h2.className = 'list-title';
      h2.textContent = lista.titulo;
      h2.addEventListener('contextmenu', (e) => openCtxMenu(e, listaIdx));
      block.appendChild(h2);

      const card = document.createElement('div');
      card.className = 'list-card';
      card.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.task-item') && !e.target.closest('.add-task-area')) {
          openCtxMenu(e, listaIdx);
        }
      });

      if (lista.periodo) {
        const period = document.createElement('p');
        period.className = 'list-period';
        period.textContent = lista.periodo;
        card.appendChild(period);
      }

      const pendentes = lista.tarefas.filter(t => !t.concluida);
      const concluidas = lista.tarefas.filter(t => t.concluida);

      const taskListEl = document.createElement('div');
      taskListEl.className = 'task-list';
      pendentes.forEach((tarefa) => {
        const realIdx = lista.tarefas.indexOf(tarefa);
        taskListEl.appendChild(buildTaskItem(tarefa, listaIdx, realIdx, false));
      });
      card.appendChild(taskListEl);

      if (concluidas.length > 0) {
        const doneSection = document.createElement('div');
        doneSection.className = 'done-section';

        const toggle = document.createElement('div');
        toggle.className = 'done-toggle';
        toggle.id = `done-toggle-${listaIdx}`;
        toggle.innerHTML = `<span class="arrow">▶</span> Concluída (${concluidas.length})`;
        toggle.addEventListener('click', () => toggleDoneSection(listaIdx));
        doneSection.appendChild(toggle);

        const doneList = document.createElement('div');
        doneList.className = 'done-list';
        doneList.id = `done-list-${listaIdx}`;
        concluidas.forEach((tarefa) => {
          const realIdx = lista.tarefas.indexOf(tarefa);
          doneList.appendChild(buildTaskItem(tarefa, listaIdx, realIdx, true));
        });
        doneSection.appendChild(doneList);
        card.appendChild(doneSection);
      }

      card.appendChild(buildAddArea(listaIdx));
      block.appendChild(card);
      rowEl.appendChild(block);
    });
  }

  function buildTaskItem(tarefa, listaIdx, tarefaIdx, isDone) {
    const item = document.createElement('div');
    item.className = `task-item ${isDone ? 'done' : ''}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = tarefa.concluida;
    cb.addEventListener('change', (e) => handleToggle(e.target, listaIdx, tarefaIdx));
    cb.addEventListener('click', (e) => e.stopPropagation());

    const content = document.createElement('div');
    content.className = 'task-content';

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = tarefa.texto;
    content.appendChild(textSpan);

    if (tarefa.notes) {
      const notesEl = document.createElement('div');
      notesEl.className = 'task-notes';
      notesEl.textContent = tarefa.notes;
      content.appendChild(notesEl);
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'task-meta-row';

    const dtStr = formatDateTime(tarefa.data, tarefa.hora);
    if (dtStr) {
      const chip = document.createElement('span');
      chip.className = 'task-chip chip-date';
      chip.textContent = '📅 ' + dtStr;
      metaRow.appendChild(chip);
    }

    if (tarefa.priority) {
      const labels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
      const chip = document.createElement('span');
      chip.className = `task-chip chip-priority ${tarefa.priority}`;
      chip.textContent = '⚑ ' + (labels[tarefa.priority] || tarefa.priority);
      metaRow.appendChild(chip);
    }

    if (metaRow.children.length) content.appendChild(metaRow);

    item.appendChild(cb);
    item.appendChild(content);
    item.addEventListener('click', () => openEditModal(listaIdx, tarefaIdx));
    return item;
  }

  function buildAddArea(listaIdx) {
    const area = document.createElement('div');
    area.className = 'add-task-area';
    area.id = `add-area-${listaIdx}`;

    const simpleBtn = document.createElement('div');
    simpleBtn.className = 'add-task-simple';
    simpleBtn.id = `add-simple-${listaIdx}`;
    simpleBtn.innerHTML = '<span class="plus">+</span> Adicionar uma tarefa';
    simpleBtn.addEventListener('click', () => openComposer(listaIdx));
    area.appendChild(simpleBtn);

    const composerWrap = document.createElement('div');
    composerWrap.className = 'task-composer-wrap';
    composerWrap.id = `composer-${listaIdx}`;
    composerWrap.innerHTML = `
      <div class="task-composer">
        <input type="text" class="task-title-input" id="input-text-${listaIdx}" placeholder="Título da tarefa">
        <textarea class="task-notes-input" id="input-notes-${listaIdx}" placeholder="Observações" rows="2"></textarea>

        <div class="date-picker-row" id="date-row-${listaIdx}">
          <label>📅</label>
          <input type="date" id="input-date-${listaIdx}">
          <label>⏰</label>
          <input type="time" id="input-time-${listaIdx}">
        </div>

        <div class="priority-row" id="priority-row-${listaIdx}">
          <label>⚑ Prioridade:</label>
          <select id="input-priority-${listaIdx}">
            <option value="">Sem prioridade</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>

        <div class="composer-meta">
          <button type="button" class="meta-btn" id="btn-date-${listaIdx}" onclick="toggleDatePicker(${listaIdx})">📅 Data / Hora</button>
          <button type="button" class="meta-btn" id="btn-priority-${listaIdx}" onclick="togglePriorityPicker(${listaIdx})">⚑ Prioridade</button>
        </div>

        <div class="composer-footer">
          <button type="button" class="btn-cancel" onclick="closeComposer(${listaIdx})">Cancelar</button>
          <button type="button" class="btn-add" onclick="addTask(${listaIdx})">Adicionar</button>
        </div>
      </div>
    `;
    area.appendChild(composerWrap);

    setTimeout(() => {
      const inp = document.getElementById(`input-text-${listaIdx}`);
      if (inp) {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addTask(listaIdx);
          }
        });
      }
    }, 0);

    return area;
  }

  function openComposer(listaIdx) {
    const simpleBtn = document.getElementById(`add-simple-${listaIdx}`);
    const composer = document.getElementById(`composer-${listaIdx}`);
    if (simpleBtn) simpleBtn.style.display = 'none';
    if (composer) composer.classList.add('open');
    setTimeout(() => {
      const inp = document.getElementById(`input-text-${listaIdx}`);
      if (inp) inp.focus();
    }, 50);
  }

  function closeComposer(listaIdx) {
    const simpleBtn = document.getElementById(`add-simple-${listaIdx}`);
    const composer = document.getElementById(`composer-${listaIdx}`);
    if (simpleBtn) simpleBtn.style.display = '';
    if (composer) composer.classList.remove('open');
    ['input-text-', 'input-notes-', 'input-date-', 'input-time-'].forEach((prefix) => {
      const el = document.getElementById(prefix + listaIdx);
      if (el) el.value = '';
    });
    const pr = document.getElementById(`input-priority-${listaIdx}`);
    if (pr) pr.value = '';
    const dr = document.getElementById(`date-row-${listaIdx}`);
    if (dr) dr.classList.remove('open');
    const prr = document.getElementById(`priority-row-${listaIdx}`);
    if (prr) prr.classList.remove('open');
    const btnD = document.getElementById(`btn-date-${listaIdx}`);
    if (btnD) btnD.classList.remove('active');
    const btnP = document.getElementById(`btn-priority-${listaIdx}`);
    if (btnP) btnP.classList.remove('active');
  }

  window.toggleDatePicker = function (listaIdx) {
    const row = document.getElementById(`date-row-${listaIdx}`);
    const btn = document.getElementById(`btn-date-${listaIdx}`);
    if (row) row.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
  };

  window.togglePriorityPicker = function (listaIdx) {
    const row = document.getElementById(`priority-row-${listaIdx}`);
    const btn = document.getElementById(`btn-priority-${listaIdx}`);
    if (row) row.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
  };

  window.addTask = function (listaIdx) {
    const texto = document.getElementById(`input-text-${listaIdx}`)?.value.trim();
    if (!texto) return;
    minhasListas[listaIdx].tarefas.push({
      texto,
      concluida: false,
      data: document.getElementById(`input-date-${listaIdx}`)?.value || '',
      hora: document.getElementById(`input-time-${listaIdx}`)?.value || '',
      notes: document.getElementById(`input-notes-${listaIdx}`)?.value.trim() || '',
      priority: document.getElementById(`input-priority-${listaIdx}`)?.value || ''
    });
    salvar();
    render();
  };

  function handleToggle(checkbox, listaIdx, tarefaIdx) {
    const item = checkbox.closest('.task-item');
    minhasListas[listaIdx].tarefas[tarefaIdx].concluida = checkbox.checked;
    salvar();
    if (checkbox.checked) {
      item.classList.add('task-fade-out');
      setTimeout(render, 400);
    } else {
      render();
    }
  }

  function toggleDoneSection(listaIdx) {
    const toggle = document.getElementById(`done-toggle-${listaIdx}`);
    const list = document.getElementById(`done-list-${listaIdx}`);
    if (toggle) toggle.classList.toggle('open');
    if (list) list.classList.toggle('visible');
  }

  window.createList = function () {
    const nameInput = document.getElementById('new-list-name');
    const periodInput = document.getElementById('new-list-period');
    if (nameInput) nameInput.value = '';
    if (periodInput) periodInput.value = '';
    const modal = document.getElementById('createListModal');
    if (modal) modal.classList.add('open');
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 80);
  };

  function closeCreateModal() {
    const modal = document.getElementById('createListModal');
    if (modal) modal.classList.remove('open');
  }

  window.closeCreateModal = closeCreateModal;

  window.confirmCreateList = function () {
    const nameInput = document.getElementById('new-list-name');
    const periodInput = document.getElementById('new-list-period');
    const nome = nameInput?.value.trim();
    if (!nome) return;
    const periodo = periodInput?.value.trim() || '';
    minhasListas.push({ titulo: nome, periodo, tarefas: [] });
    salvar();
    closeCreateModal();
    render();
  };

  function openCtxMenu(e, listaIdx) {
    e.preventDefault();
    ctxListIdx = listaIdx;
    const menu = document.getElementById('ctxMenu');
    if (!menu) return;
    menu.classList.add('open');
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  function closeCtxMenu() {
    const menu = document.getElementById('ctxMenu');
    if (menu) menu.classList.remove('open');
  }

  window.ctxDeleteList = function () {
    const idx = ctxListIdx;
    closeCtxMenu();
    if (idx < 0) return;
    const nome = minhasListas[idx].titulo;
    const msg = document.getElementById('confirmDeleteMsg');
    const btn = document.getElementById('confirmDeleteBtn');
    const modal = document.getElementById('confirmDeleteModal');
    if (msg) msg.textContent = `Tem certeza que quer apagar "${nome}" e todas as suas tarefas? Essa ação não pode ser desfeita.`;
    if (btn) {
      btn.onclick = function () {
        minhasListas.splice(idx, 1);
        salvar();
        render();
        ctxListIdx = -1;
        if (modal) modal.classList.remove('open');
      };
    }
    if (modal) modal.classList.add('open');
  };

  window.ctxRenameList = function () {
    closeCtxMenu();
    if (ctxListIdx < 0) return;
    const nameInput = document.getElementById('new-list-name');
    const periodInput = document.getElementById('new-list-period');
    const modalTitle = document.querySelector('#createListModal h3');
    const modalBtn = document.querySelector('#createListModal .modal-btn-primary');
    const nomeAtual = minhasListas[ctxListIdx].titulo;
    if (nameInput) nameInput.value = nomeAtual;
    if (periodInput) periodInput.value = minhasListas[ctxListIdx].periodo || '';
    const modal = document.getElementById('createListModal');
    if (modal) modal.classList.add('open');
    if (modalTitle) modalTitle.textContent = 'Renomear lista';
    setTimeout(() => {
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 80);
    if (modalBtn) {
      modalBtn.onclick = function () {
        const nome = nameInput?.value.trim();
        if (!nome) return;
        minhasListas[ctxListIdx].titulo = nome;
        minhasListas[ctxListIdx].periodo = periodInput?.value.trim() || '';
        salvar();
        closeCreateModal();
        if (modalTitle) modalTitle.textContent = 'Nova lista';
        if (modalBtn) modalBtn.onclick = window.confirmCreateList;
        render();
        ctxListIdx = -1;
      };
    }
  };

  function openEditModal(listaIdx, tarefaIdx) {
    const tarefa = minhasListas[listaIdx].tarefas[tarefaIdx];
    editingList = listaIdx;
    editingTask = tarefaIdx;

    const editText = document.getElementById('edit-text');
    const editNotes = document.getElementById('edit-notes');
    const editDate = document.getElementById('edit-date');
    const editTime = document.getElementById('edit-time');
    const editPriority = document.getElementById('edit-priority');
    const modal = document.getElementById('editModal');

    if (editText) editText.value = tarefa.texto || '';
    if (editNotes) editNotes.value = tarefa.notes || '';
    if (editDate) editDate.value = tarefa.data || '';
    if (editTime) editTime.value = tarefa.hora || '';
    if (editPriority) editPriority.value = tarefa.priority || '';
    if (modal) modal.classList.add('open');
    setTimeout(() => { if (editText) editText.focus(); }, 80);
  }

  function closeModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('open');
    editingList = -1;
    editingTask = -1;
  }

  window.closeModal = closeModal;

  window.saveEdit = function () {
    if (editingList < 0 || editingTask < 0) return;
    const tarefa = minhasListas[editingList].tarefas[editingTask];
    const editText = document.getElementById('edit-text');
    const editNotes = document.getElementById('edit-notes');
    const editDate = document.getElementById('edit-date');
    const editTime = document.getElementById('edit-time');
    const editPriority = document.getElementById('edit-priority');
    const texto = editText?.value.trim();
    if (!texto) return;
    tarefa.texto = texto;
    tarefa.notes = editNotes?.value.trim() || '';
    tarefa.data = editDate?.value || '';
    tarefa.hora = editTime?.value || '';
    tarefa.priority = editPriority?.value || '';
    salvar();
    closeModal();
    render();
  };

  window.deleteTask = function () {
    if (editingList < 0 || editingTask < 0) return;
    if (!confirm('Excluir esta tarefa?')) return;
    minhasListas[editingList].tarefas.splice(editingTask, 1);
    salvar();
    closeModal();
    render();
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#ctxMenu')) closeCtxMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCtxMenu();
      closeCreateModal();
      closeModal();
    }
  });

  const createListModal = document.getElementById('createListModal');
  if (createListModal) {
    createListModal.addEventListener('click', function (e) {
      if (e.target === this) closeCreateModal();
    });
  }

  const editModal = document.getElementById('editModal');
  if (editModal) {
    editModal.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  const nameInput = document.getElementById('new-list-name');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.confirmCreateList();
    });
  }

  const LISTAS_LAYOUT_KEY = 'niane-listas-layout';

  function aplicarLayoutListas(modo) {
    const scrollEl = document.getElementById('listsScroll');
    const btnH = document.getElementById('layoutBtnHorizontal');
    const btnV = document.getElementById('layoutBtnVertical');
    const vertical = modo === 'vertical';
    if (scrollEl) scrollEl.classList.toggle('vertical-mode', vertical);
    if (btnH) btnH.classList.toggle('active', !vertical);
    if (btnV) btnV.classList.toggle('active', vertical);
    if (btnH) btnH.setAttribute('aria-pressed', String(!vertical));
    if (btnV) btnV.setAttribute('aria-pressed', String(vertical));
    try { localStorage.setItem(LISTAS_LAYOUT_KEY, modo); } catch (e) {}
  }

  const layoutBtnHorizontal = document.getElementById('layoutBtnHorizontal');
  const layoutBtnVertical = document.getElementById('layoutBtnVertical');
  if (layoutBtnHorizontal) {
    layoutBtnHorizontal.addEventListener('click', () => aplicarLayoutListas('horizontal'));
  }
  if (layoutBtnVertical) {
    layoutBtnVertical.addEventListener('click', () => aplicarLayoutListas('vertical'));
  }

  let layoutSalvo = 'vertical';
  try { layoutSalvo = localStorage.getItem(LISTAS_LAYOUT_KEY) || 'vertical'; } catch (e) {}
  aplicarLayoutListas(layoutSalvo);

  render();
})();
