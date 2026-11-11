/* ==========================================================================
   NIANE — lists.js  (My Lists)
   --------------------------------------------------------------------------
   Listas e tarefas vivem no Supabase (NianeServices.lists / .tasks); o RLS
   do banco garante que cada usuário só vê e altera as próprias.
   Este arquivo só cuida da tela: render, modais e eventos.
   ========================================================================== */
(function () {
  'use strict';

  var U = window.NianeUtils;
  var S = window.NianeServices;

  // Modelo em memória (formato usado pela tela):
  // [{ id, titulo, periodo, tarefas: [{ id, texto, concluida, data, hora, notes, priority }] }]
  var minhasListas = [];

  var editingList = -1;
  var editingTask = -1;
  var ctxListIdx = -1;
  var listModal = { mode: 'create', idx: -1 };
  var dragInfo = null;

  /* ------------------------------------------------------------------------
     Conversão banco <-> tela
     ------------------------------------------------------------------------ */
  function taskFromDb(t) {
    return {
      id: t.id,
      texto: t.title,
      concluida: !!t.is_completed,
      data: t.due_date || '',
      hora: t.due_time ? String(t.due_time).slice(0, 5) : '',
      notes: t.description || '',
      priority: t.priority || ''
    };
  }

  function listFromDb(l) {
    return {
      id: l.id,
      titulo: l.title,
      periodo: l.period_label || '',
      tarefas: (l.tasks || []).map(taskFromDb)
    };
  }

  function nextPosition(items) {
    return items.length;
  }

  /* ------------------------------------------------------------------------
     Carregamento
     ------------------------------------------------------------------------ */
  function rowEl() { return document.getElementById('listsRow'); }

  async function carregar() {
    var el = rowEl();
    if (!el) return;
    U.renderState(el, 'loading', 'Carregando suas listas…');
    try {
      var user = await window.NianeApp.ready;
      try {
        var mig = await S.migration.migrateLists(user.id);
        if (mig.migrated) U.toast('Importamos ' + mig.lists + ' lista(s) e ' + mig.tasks + ' tarefa(s) que estavam salvas neste navegador.', 'success', 5000);
      } catch (migErr) {
        // A migração pode ser tentada de novo no próximo carregamento; não bloqueia a tela.
        U.reportError(migErr);
      }
      var data = await S.lists.fetchAllWithTasks();
      minhasListas = data.map(listFromDb);
      render();
    } catch (err) {
      if (err && err.kind === 'auth') return; // app.js já redireciona para o login
      var e = U.toNianeError(err);
      U.renderState(el, 'error', e.message, carregar);
    }
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  function formatDateTime(data, hora) {
    var parts = [];
    if (data) {
      var d = new Date(data + 'T00:00:00');
      parts.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
    }
    if (hora) parts.push(hora);
    return parts.join(' · ');
  }

  function render() {
    var el = rowEl();
    if (!el) return;
    el.innerHTML = '';

    if (!minhasListas.length) {
      U.renderState(el, 'empty', 'Você ainda não tem listas. Clique em "Criar nova lista" para começar.');
      return;
    }

    minhasListas.forEach(function (lista, listaIdx) {
      var block = document.createElement('div');
      block.className = 'list-block';

      var h2 = document.createElement('h2');
      h2.className = 'list-title';
      h2.textContent = lista.titulo;
      h2.addEventListener('contextmenu', function (e) { openCtxMenu(e, listaIdx); });
      block.appendChild(h2);

      var card = document.createElement('div');
      card.className = 'list-card';
      card.addEventListener('contextmenu', function (e) {
        if (!e.target.closest('.task-item') && !e.target.closest('.add-task-area')) {
          openCtxMenu(e, listaIdx);
        }
      });

      if (lista.periodo) {
        var period = document.createElement('p');
        period.className = 'list-period';
        period.textContent = lista.periodo;
        card.appendChild(period);
      }

      // Progresso da lista
      var total = lista.tarefas.length;
      var feitas = lista.tarefas.filter(function (t) { return t.concluida; }).length;
      if (total) {
        var prog = document.createElement('div');
        prog.className = 'list-progress';
        var bar = document.createElement('div');
        bar.className = 'list-progress-bar';
        var fill = document.createElement('div');
        fill.className = 'list-progress-fill';
        fill.style.width = Math.round((feitas / total) * 100) + '%';
        bar.appendChild(fill);
        var txt = document.createElement('span');
        txt.className = 'list-progress-text';
        txt.textContent = feitas + '/' + total + ' concluídas';
        prog.appendChild(bar);
        prog.appendChild(txt);
        card.appendChild(prog);
      }

      var pendentes = lista.tarefas.filter(function (t) { return !t.concluida; });
      var concluidas = lista.tarefas.filter(function (t) { return t.concluida; });

      var taskListEl = document.createElement('div');
      taskListEl.className = 'task-list';
      pendentes.forEach(function (tarefa) {
        var realIdx = lista.tarefas.indexOf(tarefa);
        taskListEl.appendChild(buildTaskItem(tarefa, listaIdx, realIdx, false));
      });
      card.appendChild(taskListEl);

      if (concluidas.length > 0) {
        var doneSection = document.createElement('div');
        doneSection.className = 'done-section';

        var toggle = document.createElement('div');
        toggle.className = 'done-toggle';
        toggle.id = 'done-toggle-' + listaIdx;
        toggle.innerHTML = '<span class="arrow">▶</span> Concluída (' + concluidas.length + ')';
        toggle.addEventListener('click', function () { toggleDoneSection(listaIdx); });
        doneSection.appendChild(toggle);

        var doneList = document.createElement('div');
        doneList.className = 'done-list';
        doneList.id = 'done-list-' + listaIdx;
        concluidas.forEach(function (tarefa) {
          var realIdx = lista.tarefas.indexOf(tarefa);
          doneList.appendChild(buildTaskItem(tarefa, listaIdx, realIdx, true));
        });
        doneSection.appendChild(doneList);
        card.appendChild(doneSection);
      }

      card.appendChild(buildAddArea(listaIdx));
      block.appendChild(card);
      el.appendChild(block);
    });
  }

  function buildTaskItem(tarefa, listaIdx, tarefaIdx, isDone) {
    var item = document.createElement('div');
    item.className = 'task-item ' + (isDone ? 'done' : '');
    item.dataset.taskId = tarefa.id;

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = tarefa.concluida;
    cb.addEventListener('change', function (e) { handleToggle(e.target, listaIdx, tarefaIdx); });
    cb.addEventListener('click', function (e) { e.stopPropagation(); });

    var content = document.createElement('div');
    content.className = 'task-content';

    var textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = tarefa.texto;
    content.appendChild(textSpan);

    if (tarefa.notes) {
      var notesEl = document.createElement('div');
      notesEl.className = 'task-notes';
      notesEl.textContent = tarefa.notes;
      content.appendChild(notesEl);
    }

    var metaRow = document.createElement('div');
    metaRow.className = 'task-meta-row';

    var dtStr = formatDateTime(tarefa.data, tarefa.hora);
    if (dtStr) {
      var chip = document.createElement('span');
      chip.className = 'task-chip chip-date';
      chip.textContent = '📅 ' + dtStr;
      metaRow.appendChild(chip);
    }

    if (tarefa.priority) {
      var labels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
      var chipP = document.createElement('span');
      chipP.className = 'task-chip chip-priority ' + tarefa.priority;
      chipP.textContent = '⚑ ' + (labels[tarefa.priority] || tarefa.priority);
      metaRow.appendChild(chipP);
    }

    if (metaRow.children.length) content.appendChild(metaRow);

    item.appendChild(cb);
    item.appendChild(content);
    item.addEventListener('click', function () { openEditModal(listaIdx, tarefaIdx); });

    if (!isDone) attachDrag(item, listaIdx, tarefa.id);
    return item;
  }

  /* ------------------------------------------------------------------------
     Ordenar tarefas (arrastar e soltar entre as pendentes da mesma lista)
     ------------------------------------------------------------------------ */
  function attachDrag(item, listaIdx, taskId) {
    item.draggable = true;
    item.addEventListener('dragstart', function (e) {
      dragInfo = { listaIdx: listaIdx, taskId: taskId };
      item.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', taskId); }
    });
    item.addEventListener('dragend', function () {
      item.classList.remove('dragging');
      document.querySelectorAll('.task-item.drag-over-top, .task-item.drag-over-bottom').forEach(function (n) {
        n.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });
    item.addEventListener('dragover', function (e) {
      if (!dragInfo || dragInfo.listaIdx !== listaIdx || dragInfo.taskId === taskId) return;
      e.preventDefault();
      var r = item.getBoundingClientRect();
      var before = e.clientY < r.top + r.height / 2;
      item.classList.toggle('drag-over-top', before);
      item.classList.toggle('drag-over-bottom', !before);
    });
    item.addEventListener('dragleave', function () {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    item.addEventListener('drop', function (e) {
      if (!dragInfo || dragInfo.listaIdx !== listaIdx || dragInfo.taskId === taskId) return;
      e.preventDefault();
      var r = item.getBoundingClientRect();
      var before = e.clientY < r.top + r.height / 2;
      var info = dragInfo;
      dragInfo = null;
      moveTask(info.listaIdx, info.taskId, taskId, before);
    });
  }

  async function moveTask(listaIdx, movingId, targetId, before) {
    var lista = minhasListas[listaIdx];
    var snapshot = lista.tarefas.slice();
    var moving = lista.tarefas.find(function (t) { return t.id === movingId; });
    if (!moving) return;
    var rest = lista.tarefas.filter(function (t) { return t.id !== movingId; });
    var targetPos = rest.findIndex(function (t) { return t.id === targetId; });
    if (targetPos < 0) return;
    rest.splice(before ? targetPos : targetPos + 1, 0, moving);
    lista.tarefas = rest;
    render(); // resposta imediata; reverte se o servidor recusar
    try {
      await S.tasks.reorder(rest.map(function (t) { return t.id; }));
    } catch (err) {
      lista.tarefas = snapshot;
      render();
      U.reportError(err, 'Não foi possível salvar a nova ordem.');
    }
  }

  /* ------------------------------------------------------------------------
     Compositor de tarefas
     ------------------------------------------------------------------------ */
  function buildAddArea(listaIdx) {
    var area = document.createElement('div');
    area.className = 'add-task-area';
    area.id = 'add-area-' + listaIdx;

    var simpleBtn = document.createElement('div');
    simpleBtn.className = 'add-task-simple';
    simpleBtn.id = 'add-simple-' + listaIdx;
    simpleBtn.innerHTML = '<span class="plus">+</span> Adicionar uma tarefa';
    simpleBtn.addEventListener('click', function () { openComposer(listaIdx); });
    area.appendChild(simpleBtn);

    var composerWrap = document.createElement('div');
    composerWrap.className = 'task-composer-wrap';
    composerWrap.id = 'composer-' + listaIdx;
    composerWrap.innerHTML =
      '<div class="task-composer">' +
        '<input type="text" class="task-title-input" id="input-text-' + listaIdx + '" placeholder="Título da tarefa" maxlength="300">' +
        '<textarea class="task-notes-input" id="input-notes-' + listaIdx + '" placeholder="Observações" rows="2" maxlength="5000"></textarea>' +
        '<div class="date-picker-row" id="date-row-' + listaIdx + '">' +
          '<label>📅</label><input type="date" id="input-date-' + listaIdx + '">' +
          '<label>⏰</label><input type="time" id="input-time-' + listaIdx + '">' +
        '</div>' +
        '<div class="priority-row" id="priority-row-' + listaIdx + '">' +
          '<label>⚑ Prioridade:</label>' +
          '<select id="input-priority-' + listaIdx + '">' +
            '<option value="">Sem prioridade</option><option value="alta">Alta</option>' +
            '<option value="media">Média</option><option value="baixa">Baixa</option>' +
          '</select>' +
        '</div>' +
        '<div class="composer-meta">' +
          '<button type="button" class="meta-btn" id="btn-date-' + listaIdx + '" onclick="toggleDatePicker(' + listaIdx + ')">📅 Data / Hora</button>' +
          '<button type="button" class="meta-btn" id="btn-priority-' + listaIdx + '" onclick="togglePriorityPicker(' + listaIdx + ')">⚑ Prioridade</button>' +
        '</div>' +
        '<div class="composer-footer">' +
          '<button type="button" class="btn-cancel" onclick="closeComposer(' + listaIdx + ')">Cancelar</button>' +
          '<button type="button" class="btn-add" onclick="addTask(' + listaIdx + ')">Adicionar</button>' +
        '</div>' +
      '</div>';
    area.appendChild(composerWrap);

    setTimeout(function () {
      var inp = document.getElementById('input-text-' + listaIdx);
      if (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.addTask(listaIdx);
          }
        });
      }
    }, 0);

    return area;
  }

  function openComposer(listaIdx) {
    var simpleBtn = document.getElementById('add-simple-' + listaIdx);
    var composer = document.getElementById('composer-' + listaIdx);
    if (simpleBtn) simpleBtn.style.display = 'none';
    if (composer) composer.classList.add('open');
    setTimeout(function () {
      var inp = document.getElementById('input-text-' + listaIdx);
      if (inp) inp.focus();
    }, 50);
  }

  function closeComposer(listaIdx) {
    var simpleBtn = document.getElementById('add-simple-' + listaIdx);
    var composer = document.getElementById('composer-' + listaIdx);
    if (simpleBtn) simpleBtn.style.display = '';
    if (composer) composer.classList.remove('open');
    ['input-text-', 'input-notes-', 'input-date-', 'input-time-'].forEach(function (prefix) {
      var el = document.getElementById(prefix + listaIdx);
      if (el) el.value = '';
    });
    var pr = document.getElementById('input-priority-' + listaIdx);
    if (pr) pr.value = '';
    var dr = document.getElementById('date-row-' + listaIdx);
    if (dr) dr.classList.remove('open');
    var prr = document.getElementById('priority-row-' + listaIdx);
    if (prr) prr.classList.remove('open');
    var btnD = document.getElementById('btn-date-' + listaIdx);
    if (btnD) btnD.classList.remove('active');
    var btnP = document.getElementById('btn-priority-' + listaIdx);
    if (btnP) btnP.classList.remove('active');
  }
  window.closeComposer = closeComposer;

  window.toggleDatePicker = function (listaIdx) {
    var row = document.getElementById('date-row-' + listaIdx);
    var btn = document.getElementById('btn-date-' + listaIdx);
    if (row) row.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
  };

  window.togglePriorityPicker = function (listaIdx) {
    var row = document.getElementById('priority-row-' + listaIdx);
    var btn = document.getElementById('btn-priority-' + listaIdx);
    if (row) row.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
  };

  /* ------------------------------------------------------------------------
     Tarefas: criar, marcar, editar, excluir
     ------------------------------------------------------------------------ */
  window.addTask = function (listaIdx) {
    var lista = minhasListas[listaIdx];
    if (!lista) return Promise.resolve();
    var val = function (id) { var el = document.getElementById(id + listaIdx); return el ? el.value : ''; };
    var texto = val('input-text-').trim();
    if (!texto) return Promise.resolve();
    var btn = document.querySelector('#composer-' + listaIdx + ' .btn-add');

    return U.withBusy(btn, async function () {
      try {
        var row = await S.tasks.create(lista.id, {
          title: texto,
          description: val('input-notes-'),
          due_date: val('input-date-'),
          due_time: val('input-time-'),
          priority: val('input-priority-'),
          position: nextPosition(lista.tarefas)
        });
        lista.tarefas.push(taskFromDb(row));
        render();
      } catch (err) {
        U.reportError(err, 'Não foi possível criar a tarefa.');
      }
    });
  };

  async function handleToggle(checkbox, listaIdx, tarefaIdx) {
    var item = checkbox.closest('.task-item');
    var tarefa = minhasListas[listaIdx].tarefas[tarefaIdx];
    var novo = checkbox.checked;
    checkbox.disabled = true;
    try {
      await S.tasks.setCompleted(tarefa.id, novo);
      tarefa.concluida = novo;
      if (novo && item) {
        item.classList.add('task-fade-out');
        setTimeout(render, 400);
      } else {
        render();
      }
    } catch (err) {
      checkbox.checked = !novo; // desfaz o clique: o servidor não aceitou
      checkbox.disabled = false;
      U.reportError(err, 'Não foi possível atualizar a tarefa.');
    }
  }

  function toggleDoneSection(listaIdx) {
    var toggle = document.getElementById('done-toggle-' + listaIdx);
    var list = document.getElementById('done-list-' + listaIdx);
    if (toggle) toggle.classList.toggle('open');
    if (list) list.classList.toggle('visible');
  }

  function openEditModal(listaIdx, tarefaIdx) {
    var tarefa = minhasListas[listaIdx].tarefas[tarefaIdx];
    editingList = listaIdx;
    editingTask = tarefaIdx;

    var setVal = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    setVal('edit-text', tarefa.texto || '');
    setVal('edit-notes', tarefa.notes || '');
    setVal('edit-date', tarefa.data || '');
    setVal('edit-time', tarefa.hora || '');
    setVal('edit-priority', tarefa.priority || '');
    var modal = document.getElementById('editModal');
    if (modal) modal.classList.add('open');
    setTimeout(function () { var t = document.getElementById('edit-text'); if (t) t.focus(); }, 80);
  }

  function closeModal() {
    var modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('open');
    editingList = -1;
    editingTask = -1;
  }
  window.closeModal = closeModal;

  window.saveEdit = function () {
    if (editingList < 0 || editingTask < 0) return Promise.resolve();
    var tarefa = minhasListas[editingList].tarefas[editingTask];
    var get = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var texto = get('edit-text').trim();
    if (!texto) { U.toast('A tarefa precisa ter um título.', 'error'); return Promise.resolve(); }
    var btn = document.querySelector('#editModal .modal-btn-primary');

    return U.withBusy(btn, async function () {
      try {
        var row = await S.tasks.update(tarefa.id, {
          title: texto,
          description: get('edit-notes'),
          due_date: get('edit-date'),
          due_time: get('edit-time'),
          priority: get('edit-priority')
        });
        Object.assign(tarefa, taskFromDb(row));
        closeModal();
        render();
      } catch (err) {
        U.reportError(err, 'Não foi possível salvar a tarefa.');
      }
    });
  };

  window.deleteTask = function () {
    if (editingList < 0 || editingTask < 0) return Promise.resolve();
    if (!confirm('Excluir esta tarefa?')) return Promise.resolve();
    var lista = minhasListas[editingList];
    var tarefa = lista.tarefas[editingTask];
    var btn = document.querySelector('#editModal .modal-btn-delete');

    return U.withBusy(btn, async function () {
      try {
        await S.tasks.remove(tarefa.id);
        lista.tarefas = lista.tarefas.filter(function (t) { return t.id !== tarefa.id; });
        closeModal();
        render();
      } catch (err) {
        U.reportError(err, 'Não foi possível excluir a tarefa.');
      }
    });
  };

  /* ------------------------------------------------------------------------
     Listas: criar, renomear, excluir
     ------------------------------------------------------------------------ */
  function setListModal(mode, idx) {
    listModal = { mode: mode, idx: idx };
    var title = document.querySelector('#createListModal h3');
    var btn = document.querySelector('#createListModal .modal-btn-primary');
    if (title) title.textContent = mode === 'rename' ? 'Renomear lista' : 'Nova lista';
    if (btn) btn.textContent = mode === 'rename' ? 'Salvar' : 'Criar';
  }

  window.createList = function () {
    setListModal('create', -1);
    var nameInput = document.getElementById('new-list-name');
    var periodInput = document.getElementById('new-list-period');
    if (nameInput) nameInput.value = '';
    if (periodInput) periodInput.value = '';
    var modal = document.getElementById('createListModal');
    if (modal) modal.classList.add('open');
    setTimeout(function () { if (nameInput) nameInput.focus(); }, 80);
  };

  function closeCreateModal() {
    var modal = document.getElementById('createListModal');
    if (modal) modal.classList.remove('open');
    setListModal('create', -1);
  }
  window.closeCreateModal = closeCreateModal;

  // Serve para criar E para renomear (o modo vem de listModal).
  window.confirmCreateList = function () {
    var nameInput = document.getElementById('new-list-name');
    var periodInput = document.getElementById('new-list-period');
    var nome = nameInput ? nameInput.value.trim() : '';
    if (!nome) { U.toast('Dê um nome para a lista.', 'error'); return Promise.resolve(); }
    var periodo = periodInput ? periodInput.value.trim() : '';
    var btn = document.querySelector('#createListModal .modal-btn-primary');
    var modo = listModal.mode;
    var lista = modo === 'rename' ? minhasListas[listModal.idx] : null;

    return U.withBusy(btn, async function () {
      try {
        if (modo === 'rename' && lista) {
          var row = await S.lists.update(lista.id, { title: nome, period_label: periodo });
          lista.titulo = row.title;
          lista.periodo = row.period_label || '';
        } else {
          var created = await S.lists.create({ title: nome, period_label: periodo, position: nextPosition(minhasListas) });
          minhasListas.push(listFromDb(created));
        }
        closeCreateModal();
        render();
      } catch (err) {
        U.reportError(err, 'Não foi possível salvar a lista.');
      }
    });
  };

  function openCtxMenu(e, listaIdx) {
    e.preventDefault();
    ctxListIdx = listaIdx;
    var menu = document.getElementById('ctxMenu');
    if (!menu) return;
    menu.classList.add('open');
    var x = Math.min(e.clientX, window.innerWidth - 200);
    var y = Math.min(e.clientY, window.innerHeight - 120);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  function closeCtxMenu() {
    var menu = document.getElementById('ctxMenu');
    if (menu) menu.classList.remove('open');
  }

  window.ctxDeleteList = function () {
    var idx = ctxListIdx;
    closeCtxMenu();
    if (idx < 0) return;
    var lista = minhasListas[idx];
    var msg = document.getElementById('confirmDeleteMsg');
    var btn = document.getElementById('confirmDeleteBtn');
    var modal = document.getElementById('confirmDeleteModal');
    if (msg) msg.textContent = 'Tem certeza que quer apagar "' + lista.titulo + '" e todas as suas tarefas? Essa ação não pode ser desfeita.';
    if (btn) {
      btn.onclick = function () {
        return U.withBusy(btn, async function () {
          try {
            await S.lists.remove(lista.id); // o banco apaga também as tarefas (CASCADE)
            minhasListas = minhasListas.filter(function (l) { return l.id !== lista.id; });
            ctxListIdx = -1;
            if (modal) modal.classList.remove('open');
            render();
          } catch (err) {
            U.reportError(err, 'Não foi possível apagar a lista.');
          }
        });
      };
    }
    if (modal) modal.classList.add('open');
  };

  window.ctxRenameList = function () {
    var idx = ctxListIdx;
    closeCtxMenu();
    if (idx < 0) return;
    setListModal('rename', idx);
    var nameInput = document.getElementById('new-list-name');
    var periodInput = document.getElementById('new-list-period');
    if (nameInput) nameInput.value = minhasListas[idx].titulo;
    if (periodInput) periodInput.value = minhasListas[idx].periodo || '';
    var modal = document.getElementById('createListModal');
    if (modal) modal.classList.add('open');
    setTimeout(function () {
      if (nameInput) { nameInput.focus(); nameInput.select(); }
    }, 80);
  };

  /* ------------------------------------------------------------------------
     Eventos gerais
     ------------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#ctxMenu')) closeCtxMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeCtxMenu();
      closeCreateModal();
      closeModal();
    }
  });

  var createListModal = document.getElementById('createListModal');
  if (createListModal) {
    createListModal.addEventListener('click', function (e) {
      if (e.target === this) closeCreateModal();
    });
  }

  var editModal = document.getElementById('editModal');
  if (editModal) {
    editModal.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  var nameInput = document.getElementById('new-list-name');
  if (nameInput) {
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.confirmCreateList();
    });
  }

  /* Layout horizontal/vertical (preferência só visual, fica no navegador) */
  var LISTAS_LAYOUT_KEY = 'niane-listas-layout';

  function aplicarLayoutListas(modo) {
    var scrollEl = document.getElementById('listsScroll');
    var btnH = document.getElementById('layoutBtnHorizontal');
    var btnV = document.getElementById('layoutBtnVertical');
    var vertical = modo === 'vertical';
    if (scrollEl) scrollEl.classList.toggle('vertical-mode', vertical);
    if (btnH) btnH.classList.toggle('active', !vertical);
    if (btnV) btnV.classList.toggle('active', vertical);
    if (btnH) btnH.setAttribute('aria-pressed', String(!vertical));
    if (btnV) btnV.setAttribute('aria-pressed', String(vertical));
    try { localStorage.setItem(LISTAS_LAYOUT_KEY, modo); } catch (e) { /* storage indisponível: só não lembra a preferência */ }
  }

  var layoutBtnHorizontal = document.getElementById('layoutBtnHorizontal');
  var layoutBtnVertical = document.getElementById('layoutBtnVertical');
  if (layoutBtnHorizontal) layoutBtnHorizontal.addEventListener('click', function () { aplicarLayoutListas('horizontal'); });
  if (layoutBtnVertical) layoutBtnVertical.addEventListener('click', function () { aplicarLayoutListas('vertical'); });

  var layoutSalvo = 'vertical';
  try { layoutSalvo = localStorage.getItem(LISTAS_LAYOUT_KEY) || 'vertical'; } catch (e) { /* usa o padrão */ }
  aplicarLayoutListas(layoutSalvo);

  carregar();
})();
