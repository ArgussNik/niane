/* ==========================================================================
   NIANE — services/notes.service.js
   CRUD de notas (tabela notes). Expõe `NianeServices.notes`.
   - O conteúdo é HTML do editor e SEMPRE passa por sanitizeNoteHtml antes de
     ir para o banco (e de novo ao ser exibido no editor).
   - update() usa "concorrência otimista": só grava se a nota no servidor
     ainda estiver na versão (updated_at) que o navegador conhece. Assim uma
     aba/dispositivo antigo não sobrescreve sem querer uma edição mais nova.
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var COLS = 'id, title, content, created_at, updated_at';
  var MAX_TITLE = 200;
  var MAX_CONTENT = 500000;

  function clean(fields) {
    var out = {};
    if ('title' in fields) {
      var t = String(fields.title || '');
      if (t.length > MAX_TITLE) throw new U.NianeError('validation', 'O título da nota pode ter no máximo ' + MAX_TITLE + ' caracteres.');
      out.title = t;
    }
    if ('content' in fields) {
      var c = U.sanitizeNoteHtml(fields.content);
      if (c.length > MAX_CONTENT) throw new U.NianeError('validation', 'A nota é grande demais para ser salva.');
      out.content = c;
    }
    return out;
  }

  async function list() {
    return U.guard(async function () {
      return U.unwrap(await sb.from('notes').select(COLS).order('updated_at', { ascending: false })) || [];
    });
  }

  async function create(fields) {
    var row = clean(Object.assign({ title: '', content: '' }, fields));
    return U.guard(async function () {
      return U.unwrap(await sb.from('notes').insert(row).select(COLS).single());
    });
  }

  /* options.expectedUpdatedAt: versão conhecida. Se o servidor tiver outra,
     lança NianeError('conflict'). options.force=true ignora a checagem. */
  async function update(id, fields, options) {
    options = options || {};
    var patch = clean(fields);
    return U.guard(async function () {
      var q = sb.from('notes').update(patch).eq('id', id);
      if (options.expectedUpdatedAt && !options.force) q = q.eq('updated_at', options.expectedUpdatedAt);
      var row = U.unwrap(await q.select(COLS).maybeSingle());
      if (row) return row;
      // Nenhuma linha atualizada: a nota sumiu ou mudou no servidor.
      var exists = U.unwrap(await sb.from('notes').select('id').eq('id', id).maybeSingle());
      if (!exists) throw new U.NianeError('notfound', 'Esta nota não existe mais (foi excluída em outro lugar).');
      throw new U.NianeError('conflict', 'Esta nota foi alterada em outro lugar.');
    });
  }

  async function remove(id) {
    return U.guard(async function () {
      U.unwrap(await sb.from('notes').delete().eq('id', id));
    });
  }

  window.NianeServices.notes = {
    list: list,
    create: create,
    update: update,
    remove: remove
  };
})();
