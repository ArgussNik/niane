/* ==========================================================================
   NIANE — services/tasks.service.js
   CRUD de tarefas (tabela tasks). Expõe `NianeServices.tasks`.
   O user_id NÃO é enviado: o banco usa auth.uid() como padrão e o RLS
   rejeita qualquer tentativa de usar outro dono ou outra lista.
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var COLS = 'id, list_id, title, description, is_completed, priority, due_date, due_time, position, completed_at, created_at';
  var PRIORITIES = { alta: 1, media: 1, baixa: 1 };

  function normalize(fields) {
    var out = {};
    if ('title' in fields) {
      var t = String(fields.title || '').trim();
      if (!t) throw new U.NianeError('validation', 'A tarefa precisa ter um título.');
      if (t.length > 300) throw new U.NianeError('validation', 'O título da tarefa pode ter no máximo 300 caracteres.');
      out.title = t;
    }
    if ('description' in fields) {
      var d = String(fields.description || '').trim();
      if (d.length > 5000) throw new U.NianeError('validation', 'As observações podem ter no máximo 5000 caracteres.');
      out.description = d || null;
    }
    if ('priority' in fields) {
      if (fields.priority && !PRIORITIES[fields.priority]) throw new U.NianeError('validation', 'Prioridade inválida.');
      out.priority = fields.priority || null;
    }
    if ('due_date' in fields) out.due_date = fields.due_date || null;
    if ('due_time' in fields) out.due_time = fields.due_time || null;
    if ('position' in fields) out.position = fields.position;
    return out;
  }

  async function create(listId, fields) {
    var row = Object.assign({ list_id: listId }, normalize(Object.assign({ title: '' }, fields)));
    return U.guard(async function () {
      return U.unwrap(await sb.from('tasks').insert(row).select(COLS).single());
    });
  }

  async function update(id, fields) {
    var patch = normalize(fields);
    return U.guard(async function () {
      var row = U.unwrap(await sb.from('tasks').update(patch).eq('id', id).select(COLS).maybeSingle());
      if (!row) throw new U.NianeError('notfound', 'Tarefa não encontrada (pode ter sido excluída).');
      return row;
    });
  }

  async function setCompleted(id, completed) {
    return U.guard(async function () {
      var row = U.unwrap(await sb.from('tasks').update({
        is_completed: !!completed,
        completed_at: completed ? new Date().toISOString() : null
      }).eq('id', id).select(COLS).maybeSingle());
      if (!row) throw new U.NianeError('notfound', 'Tarefa não encontrada (pode ter sido excluída).');
      return row;
    });
  }

  async function remove(id) {
    return U.guard(async function () {
      U.unwrap(await sb.from('tasks').delete().eq('id', id));
    });
  }

  /* Grava a nova ordem: orderedIds[0] fica com position 0, e assim por diante. */
  async function reorder(orderedIds) {
    return U.guard(async function () {
      var results = await Promise.all(orderedIds.map(function (id, index) {
        return sb.from('tasks').update({ position: index }).eq('id', id);
      }));
      results.forEach(function (r) { U.unwrap(r); });
    });
  }

  window.NianeServices.tasks = {
    COLS: COLS,
    create: create,
    update: update,
    setCompleted: setCompleted,
    remove: remove,
    reorder: reorder
  };
})();
