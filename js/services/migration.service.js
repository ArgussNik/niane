/* ==========================================================================
   NIANE — services/migration.service.js
   Migra para o banco os dados que versões antigas guardavam no localStorage:
     - 'meuGerenciadorTarefas'  (listas + tarefas)
     - 'niane-notes'            (notas)

   Garantias:
   - IDEMPOTENTE: o "plano" (com os UUIDs novos) é gravado no localStorage
     ANTES de enviar, e os inserts usam upsert com ignoreDuplicates. Se a
     migração falhar no meio, a próxima tentativa reenvia o MESMO plano e
     nada é duplicado.
   - NÃO APAGA nada antes de confirmar: só depois do banco aceitar tudo, a
     chave antiga é copiada para '<chave>-migrated-backup' e marcada como
     migrada (flag por usuário). Os dados originais continuam disponíveis.
   - Os dados de exemplo ("Lista 1" fictícia) NUNCA são migrados: só o que o
     usuário realmente salvou (a chave só existe se alguém clicou em salvar).
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var LISTS_KEY = 'meuGerenciadorTarefas';
  var NOTES_KEY = 'niane-notes';

  function readJson(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function flagKey(kind, uid) { return 'niane-migrated-' + kind + ':' + uid; }
  function planKey(kind, uid) { return 'niane-migration-plan-' + kind + ':' + uid; }
  function isDone(kind, uid) { try { return localStorage.getItem(flagKey(kind, uid)) === '1'; } catch (e) { return true; } }

  function finish(kind, uid, sourceKey) {
    try {
      var raw = localStorage.getItem(sourceKey);
      if (raw != null) localStorage.setItem(sourceKey + '-migrated-backup', raw);
      localStorage.setItem(flagKey(kind, uid), '1');
      localStorage.removeItem(planKey(kind, uid));
      localStorage.removeItem(sourceKey); // seguro: o backup já foi gravado e o banco confirmou
    } catch (e) { console.warn('[NIANE] não foi possível finalizar a limpeza local da migração', e); }
  }

  function chunk(arr, n) { var out = []; for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

  function validPriority(p) { return p === 'alta' || p === 'media' || p === 'baixa' ? p : null; }
  function validDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : null; }
  function validTime(t) { return /^\d{2}:\d{2}(:\d{2})?$/.test(String(t || '')) ? t : null; }

  /* Retorna { migrated: boolean, lists, tasks }. Lança NianeError em falha. */
  async function migrateLists(uid) {
    if (!uid || isDone('lists', uid)) return { migrated: false };
    var local = readJson(LISTS_KEY);
    if (!Array.isArray(local) || !local.length) return { migrated: false };

    var plan = readJson(planKey('lists', uid));
    if (!plan) {
      plan = local.map(function (l, li) {
        return {
          id: U.uuid(),
          title: String(l.titulo || 'Lista ' + (li + 1)).trim().slice(0, 120) || 'Lista ' + (li + 1),
          period_label: String(l.periodo || '').trim().slice(0, 120) || null,
          position: li,
          tasks: (Array.isArray(l.tarefas) ? l.tarefas : []).map(function (t, ti) {
            return {
              id: U.uuid(),
              title: String(t.texto || '').trim().slice(0, 300) || '(sem título)',
              description: String(t.notes || '').trim().slice(0, 5000) || null,
              is_completed: !!t.concluida,
              completed_at: t.concluida ? new Date().toISOString() : null,
              priority: validPriority(t.priority),
              due_date: validDate(t.data),
              due_time: validTime(t.hora),
              position: ti
            };
          })
        };
      });
      if (!writeJson(planKey('lists', uid), plan)) {
        throw new U.NianeError('unknown', 'Não foi possível preparar a migração dos dados locais.');
      }
    }

    return U.guard(async function () {
      var listRows = plan.map(function (l) {
        return { id: l.id, title: l.title, period_label: l.period_label, position: l.position };
      });
      U.unwrap(await sb.from('lists').upsert(listRows, { onConflict: 'id', ignoreDuplicates: true }));

      var taskRows = [];
      plan.forEach(function (l) {
        l.tasks.forEach(function (t) { taskRows.push(Object.assign({ list_id: l.id }, t)); });
      });
      for (var group of chunk(taskRows, 200)) {
        U.unwrap(await sb.from('tasks').upsert(group, { onConflict: 'id', ignoreDuplicates: true }));
      }
      finish('lists', uid, LISTS_KEY);
      return { migrated: true, lists: plan.length, tasks: taskRows.length };
    });
  }

  async function migrateNotes(uid) {
    if (!uid || isDone('notes', uid)) return { migrated: false };
    var local = readJson(NOTES_KEY);
    if (!Array.isArray(local) || !local.length) return { migrated: false };

    var plan = readJson(planKey('notes', uid));
    if (!plan) {
      plan = local.map(function (n) {
        var ts = Number(n.updatedAt);
        var iso = isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : new Date().toISOString();
        return {
          id: U.uuid(),
          title: String(n.title || '').slice(0, 200),
          content: U.sanitizeNoteHtml(n.content || ''),
          created_at: iso,
          updated_at: iso
        };
      }).filter(function (n) { return n.title || U.htmlToText(n.content); }); // ignora notas vazias
      if (!writeJson(planKey('notes', uid), plan)) {
        throw new U.NianeError('unknown', 'Não foi possível preparar a migração das notas locais.');
      }
    }

    return U.guard(async function () {
      for (var group of chunk(plan, 20)) {
        U.unwrap(await sb.from('notes').upsert(group, { onConflict: 'id', ignoreDuplicates: true }));
      }
      finish('notes', uid, NOTES_KEY);
      return { migrated: true, notes: plan.length };
    });
  }

  window.NianeServices.migration = { migrateLists: migrateLists, migrateNotes: migrateNotes };
})();
