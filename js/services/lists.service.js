/* ==========================================================================
   NIANE — services/lists.service.js
   CRUD de listas (tabela lists). Expõe `NianeServices.lists`.
   Excluir uma lista exclui suas tarefas (ON DELETE CASCADE no banco).
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var LIST_COLS = 'id, title, description, period_label, start_date, end_date, position, created_at';

  function normalize(fields) {
    var out = {};
    if ('title' in fields) {
      var t = String(fields.title || '').trim();
      if (!t) throw new U.NianeError('validation', 'A lista precisa ter um nome.');
      if (t.length > 120) throw new U.NianeError('validation', 'O nome da lista pode ter no máximo 120 caracteres.');
      out.title = t;
    }
    if ('period_label' in fields) {
      var p = String(fields.period_label || '').trim();
      if (p.length > 120) throw new U.NianeError('validation', 'O período pode ter no máximo 120 caracteres.');
      out.period_label = p || null;
    }
    if ('description' in fields) out.description = String(fields.description || '').trim() || null;
    if ('start_date' in fields) out.start_date = fields.start_date || null;
    if ('end_date' in fields) out.end_date = fields.end_date || null;
    if ('position' in fields) out.position = fields.position;
    return out;
  }

  /* Busca todas as listas do usuário já com as tarefas aninhadas (1 requisição). */
  async function fetchAllWithTasks() {
    return U.guard(async function () {
      var data = U.unwrap(await sb.from('lists')
        .select(LIST_COLS + ', tasks(' + window.NianeServices.tasks.COLS + ')')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .order('position', { ascending: true, referencedTable: 'tasks' })
        .order('created_at', { ascending: true, referencedTable: 'tasks' }));
      return data || [];
    });
  }

  async function create(fields) {
    var row = normalize(Object.assign({ title: '' }, fields));
    return U.guard(async function () {
      return U.unwrap(await sb.from('lists').insert(row).select(LIST_COLS).single());
    });
  }

  async function update(id, fields) {
    var patch = normalize(fields);
    return U.guard(async function () {
      var row = U.unwrap(await sb.from('lists').update(patch).eq('id', id).select(LIST_COLS).maybeSingle());
      if (!row) throw new U.NianeError('notfound', 'Lista não encontrada (pode ter sido excluída).');
      return row;
    });
  }

  async function remove(id) {
    return U.guard(async function () {
      U.unwrap(await sb.from('lists').delete().eq('id', id));
    });
  }

  window.NianeServices.lists = {
    fetchAllWithTasks: fetchAllWithTasks,
    create: create,
    update: update,
    remove: remove
  };
})();
