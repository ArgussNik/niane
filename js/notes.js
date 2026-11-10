/* ==========================================================================
   NIANE — notes.js
   --------------------------------------------------------------------------
   As notas vivem no Supabase (NianeServices.notes); o RLS do banco garante
   que cada usuário só vê e altera as próprias.

   A área de edição é uma div "contenteditable": cada formatação (Fonte,
   Tamanho, Cor, Título) envolve só o TRECHO SELECIONADO em um <span> com
   estilo, preservando o resto do texto.

     - Galeria de notas (cards, busca, criar, excluir)
     - Editor rich-text simples: formatação por seleção
     - Tabela e lista de tarefas inseridas como HTML na posição do cursor
     - Autosave com debounce, estado de salvamento, retry e proteção contra
       sobrescrita (concorrência otimista por updated_at)
   O HTML do editor é sanitizado (lista de tags/estilos permitidos) ao ser
   exibido e ANTES de ser gravado.
   ========================================================================== */
(function () {
  'use strict';

  var U = window.NianeUtils;
  var S = window.NianeServices;

  var galleryView = document.getElementById('viewGallery');
  var editorView = document.getElementById('viewEditor');
  var notesGrid = document.getElementById('notesGrid');
  var titleInput = document.getElementById('noteTitleInput');
  var textarea = document.getElementById('noteTextarea'); // div contenteditable
  var saveStatus = document.getElementById('saveStatus');
  var deleteModal = document.getElementById('deleteModal');

  // notas em memória: { id, title, content, created_at, updated_at }
  var notes = [];
  var currentId = null;
  var pendingDeleteId = null;
  var savedRange = null; // última seleção de texto feita dentro do editor
  var loadError = null;

  var AUTOSAVE_MS = 800;
  var RETRY_DELAYS = [3000, 8000, 20000, 45000];

  var dirty = false;          // há alterações ainda não confirmadas pelo servidor
  var saving = false;         // uma gravação está em andamento
  var saveAgain = false;      // houve edição durante a gravação
  var retryTimer = null;
  var retryCount = 0;

  function formatDate(ts) { return U.formatDateBR(ts); }
  function currentNote() { return notes.find(function (n) { return n.id === currentId; }) || null; }

  function setStatus(text) { if (saveStatus) saveStatus.textContent = text; }

  /* ------------------------------------------------------------------------
     Carregamento
     ------------------------------------------------------------------------ */
  async function carregar() {
    U.renderState(notesGrid, 'loading', 'Carregando suas notas…');
    try {
      var user = await window.NianeApp.ready;
      try {
        var mig = await S.migration.migrateNotes(user.id);
        if (mig.migrated) U.toast('Importamos ' + mig.notes + ' nota(s) que estavam salvas neste navegador.', 'success', 5000);
      } catch (migErr) {
        U.reportError(migErr); // tentará de novo no próximo carregamento
      }
      notes = await S.notes.list();
      loadError = null;
      renderGallery(currentSearch());
    } catch (err) {
      if (err && err.kind === 'auth') return; // app.js redireciona para o login
      loadError = U.toNianeError(err);
      U.renderState(notesGrid, 'error', loadError.message, carregar);
    }
  }

  function currentSearch() {
    var input = document.querySelector('.search-input');
    return input ? input.value : '';
  }

  /* ------------------------------------------------------------------------
     Galeria
     ------------------------------------------------------------------------ */
  function renderGallery(filter) {
    if (loadError) return;
    var term = (filter || '').trim().toLowerCase();
    var list = notes
      .slice()
      .sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); })
      .filter(function (n) {
        return !term || (n.title + ' ' + U.htmlToText(n.content)).toLowerCase().indexOf(term) !== -1;
      });

    if (!list.length) {
      U.renderState(notesGrid, 'empty', notes.length
        ? 'Nenhuma nota encontrada.'
        : 'Você ainda não tem notas. Crie a primeira abaixo!');
      return;
    }

    notesGrid.innerHTML = list.map(function (n) {
      var preview = U.htmlToText(n.content).slice(0, 240);
      return '' +
        '<div class="note-card" data-id="' + U.escapeHtml(n.id) + '">' +
          '<div class="note-card-title">' + U.escapeHtml(n.title || 'Sem título') + '</div>' +
          '<div class="note-card-preview">' + U.escapeHtml(preview) + '</div>' +
          '<div class="note-card-footer">' +
            '<span class="note-card-date">' + formatDate(n.updated_at) + '</span>' +
            '<button class="btn-delete-card" title="Excluir nota">🗑️</button>' +
          '</div>' +
        '</div>';
    }).join('');

    notesGrid.querySelectorAll('.note-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      card.addEventListener('click', function () { openNote(id); });
      card.querySelector('.btn-delete-card').addEventListener('click', function (e) {
        e.stopPropagation();
        requestDelete(id);
      });
    });
  }

  window.filterNotes = function (value) { renderGallery(value); };

  /* ------------------------------------------------------------------------
     Editor
     ------------------------------------------------------------------------ */
  function openNote(id) {
    var note = notes.find(function (n) { return n.id === id; });
    if (!note) return;
    currentId = id;
    dirty = false; saving = false; saveAgain = false; retryCount = 0;
    clearTimeout(retryTimer);
    titleInput.value = note.title || '';
    textarea.innerHTML = U.sanitizeNoteHtml(note.content || '');
    savedRange = null;
    galleryView.classList.add('hidden');
    editorView.classList.remove('hidden');
    setStatus('💾 Salvo');
    textarea.focus();
  }

  window.newNote = function () {
    var btn = document.querySelector('.create-btn');
    return U.withBusy(btn, async function () {
      try {
        var row = await S.notes.create({ title: '', content: '' });
        notes.push(row);
        openNote(row.id);
      } catch (err) {
        U.reportError(err, 'Não foi possível criar a nota.');
      }
    });
  };

  /* Salva tudo que está pendente e só então volta para a galeria. Se o
     servidor não aceitar, o usuário continua na nota (nada é perdido). */
  window.backToGallery = async function () {
    if (currentId && (dirty || saving)) {
      debouncedSave.cancel();
      var ok = await persistCurrent();
      if (!ok && dirty) {
        U.toast('Ainda não foi possível salvar esta nota. Fique aqui até a conexão voltar.', 'error');
        return;
      }
    }
    clearTimeout(retryTimer);
    editorView.classList.add('hidden');
    galleryView.classList.remove('hidden');
    currentId = null;
    renderGallery(currentSearch());
  };

  /* ------------------------------------------------------------------------
     Autosave
     ------------------------------------------------------------------------ */
  var debouncedSave = U.debounce(function () { persistCurrent(); }, AUTOSAVE_MS);

  // Chamado pelos oninput do título e do editor.
  window.autoSave = function () {
    if (!currentId) return;
    dirty = true;
    setStatus('💾 Salvando...');
    debouncedSave();
  };

  /* Grava a nota atual. Retorna true se ficou tudo salvo. */
  async function persistCurrent() {
    var note = currentNote();
    if (!note) return true;
    if (saving) { saveAgain = true; return false; }
    if (!dirty) return true;

    clearTimeout(retryTimer);
    saving = true;
    dirty = false; // edições feitas durante a gravação voltam a marcar dirty
    var sentTitle = titleInput.value;
    var sentContent = textarea.innerHTML;
    var failed = false;

    try {
      var row = await S.notes.update(note.id, { title: sentTitle, content: sentContent },
        { expectedUpdatedAt: note.updated_at });
      Object.assign(note, row);
      retryCount = 0;
    } catch (err) {
      failed = true;
      dirty = true;
      var e = U.toNianeError(err);
      if (e.kind === 'conflict') {
        failed = await resolveConflict(note, sentTitle, sentContent);
      } else if (e.kind === 'notfound') {
        dirty = false;
        U.toast(e.message, 'error');
        notes = notes.filter(function (n) { return n.id !== note.id; });
        saving = false;
        window.backToGallery();
        return true;
      } else if (e.kind === 'network') {
        setStatus('⚠️ Sem conexão — tentando de novo…');
        scheduleRetry();
      } else if (e.kind === 'auth') {
        setStatus('⚠️ Sessão expirada');
        U.toast(e.message, 'error');
      } else {
        setStatus('⚠️ Erro ao salvar');
        U.toast(e.message, 'error');
        scheduleRetry();
      }
    } finally {
      saving = false;
    }

    if (!failed) {
      if (saveAgain || dirty) { saveAgain = false; setStatus('💾 Salvando...'); return persistCurrent(); }
      setStatus('💾 Salvo');
      return true;
    }
    return false;
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    var delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    retryCount += 1;
    retryTimer = setTimeout(function () { if (dirty) persistCurrent(); }, delay);
  }

  /* A nota mudou no servidor desde que a abrimos (outra aba/dispositivo).
     Retorna true se ainda há falha (nada foi gravado). */
  async function resolveConflict(note, sentTitle, sentContent) {
    var overwrite = window.confirm(
      'Esta nota foi alterada em outro lugar (outra aba ou dispositivo).\n\n' +
      'OK = sobrescrever com a SUA versão.\nCancelar = carregar a versão do servidor (suas últimas alterações aqui serão descartadas).');
    try {
      if (overwrite) {
        var row = await S.notes.update(note.id, { title: sentTitle, content: sentContent }, { force: true });
        Object.assign(note, row);
        dirty = false;
        return false;
      }
      var fresh = (await S.notes.list()).find(function (n) { return n.id === note.id; });
      if (fresh) {
        Object.assign(note, fresh);
        titleInput.value = note.title || '';
        textarea.innerHTML = U.sanitizeNoteHtml(note.content || '');
      }
      dirty = false;
      return false;
    } catch (err) {
      setStatus('⚠️ Erro ao salvar');
      U.reportError(err);
      return true;
    }
  }

  /* Última tentativa ao fechar/recarregar a aba: um PATCH com keepalive
     sobrevive ao fechamento da página (limite do navegador: ~64 KB). */
  function flushOnUnload() {
    var note = currentNote();
    if (!note || !(dirty || saving || debouncedSave.pending())) return;
    var token = window.NianeAuth.getCachedAccessToken();
    var cfg = window.NianeConfig;
    if (!token || !cfg) return;
    var body = JSON.stringify({
      title: titleInput.value.slice(0, 200),
      content: U.sanitizeNoteHtml(textarea.innerHTML)
    });
    if (body.length > 60000) return;
    try {
      fetch(cfg.SUPABASE_URL + '/rest/v1/notes?id=eq.' + encodeURIComponent(note.id) +
        '&updated_at=eq.' + encodeURIComponent(note.updated_at), {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'apikey': cfg.SUPABASE_PUBLIC_KEY,
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: body
      }).catch(function () { /* melhor esforço: a página já está fechando */ });
    } catch (e) { /* melhor esforço */ }
  }

  window.addEventListener('beforeunload', function (e) {
    if (currentId && (dirty || saving || debouncedSave.pending())) {
      flushOnUnload();
      e.preventDefault();
      e.returnValue = ''; // pede confirmação enquanto há alterações não salvas
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && currentId && dirty) {
      debouncedSave.cancel();
      persistCurrent();
    }
  });
  window.addEventListener('online', function () { if (currentId && dirty) persistCurrent(); });

  /* ------------------------------------------------------------------------
     Seleção de texto
     --------------------------------------------------------------------------
     Como clicar num botão da barra de ferramentas tira o foco do editor
     (o que normalmente apagaria a seleção), guardamos a última seleção válida
     feita DENTRO do editor em `savedRange` sempre que ela mudar. Assim, na
     hora de aplicar uma formatação, restauramos exatamente o trecho que o
     usuário havia selecionado.
     ------------------------------------------------------------------------ */
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (textarea.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  });

  function restoreSelection() {
    if (!savedRange) return null;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return sel;
  }

  /* Utilitários para mesclar estilos em vez de empilhar <span> aninhados.
     Sem isso, clicar "Título 1" várias vezes ia aumentar o tamanho a cada
     clique (1.8em dentro de 1.8em vira ~3.24em, e por aí vai). */
  function parseCssText(cssText) {
    const result = {};
    (cssText || '').split(';').forEach(rule => {
      const idx = rule.indexOf(':');
      if (idx === -1) return;
      const prop = rule.slice(0, idx).trim();
      const val = rule.slice(idx + 1).trim();
      if (prop && val) result[prop] = val;
    });
    return result;
  }

  function styleObjToCssText(obj) {
    const keys = Object.keys(obj);
    if (!keys.length) return '';
    return keys.map(k => `${k}: ${obj[k]}`).join('; ') + ';';
  }

  /* Remove todos os <span style="..."> dentro do fragmento selecionado,
     "desembrulhando" o texto, e devolve o conjunto mesclado de estilos que
     eles tinham (o mais interno/específico prevalece em caso de conflito). */
  function collectAndStripStyles(fragment) {
    const merged = {};
    const spans = fragment.querySelectorAll ? Array.from(fragment.querySelectorAll('span[style]')) : [];
    spans.forEach(span => {
      Object.assign(merged, parseCssText(span.getAttribute('style')));
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.parentNode.removeChild(span);
    });
    return merged;
  }

  /* Caso, apesar da extração acima, ainda sobre algum <span> de estilo
     "por fora" do novo span (ex: quando a seleção coincidia exatamente com
     as bordas de um span já existente), esta função sobe pelos pais e
     funde/remove essas camadas extras, para nunca deixar spans aninhados
     acumulando estilo. */
  function hoistAncestorStyleSpans(span) {
    let parent = span.parentNode;
    while (
      parent &&
      parent !== textarea &&
      parent.nodeType === 1 &&
      parent.tagName === 'SPAN' &&
      parent.hasAttribute('style') &&
      parent.childNodes.length === 1
    ) {
      const parentStyles = parseCssText(parent.getAttribute('style'));
      const currentStyles = parseCssText(span.getAttribute('style'));
      const merged = Object.assign({}, parentStyles, currentStyles); // o span novo (mais recente) tem prioridade
      span.setAttribute('style', styleObjToCssText(merged));
      const grandParent = parent.parentNode;
      grandParent.insertBefore(span, parent);
      grandParent.removeChild(parent);
      parent = span.parentNode;
    }
  }

  /* Aplica um estilo ao trecho selecionado, mesclando com o que já existia
     (em vez de aninhar um span dentro do outro). Propriedades novas
     sobrescrevem as antigas de mesmo nome; as demais são preservadas —
     assim dá pra combinar cor + fonte + título sem um apagar o outro, e
     clicar no mesmo botão várias vezes não faz o texto crescer sem parar. */
  function wrapSelectionStyle(cssText) {
    const sel = restoreSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      saveStatus.textContent = '⚠️ Selecione um trecho de texto primeiro';
      setTimeout(() => { saveStatus.textContent = '💾 Salvo'; }, 1800);
      return false;
    }
    const range = sel.getRangeAt(0);
    if (!textarea.contains(range.commonAncestorContainer)) return false;

    const contents = range.extractContents();
    const existingStyles = collectAndStripStyles(contents);
    const mergedStyles = Object.assign(existingStyles, parseCssText(cssText));

    const span = document.createElement('span');
    span.style.cssText = styleObjToCssText(mergedStyles);
    span.appendChild(contents);
    range.insertNode(span);
    hoistAncestorStyleSpans(span);

    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    savedRange = newRange.cloneRange();

    textarea.focus();
    window.autoSave();
    return true;
  }

  /* Insere HTML (tabela, checklist) na posição do cursor/seleção salva */
  function insertHtmlAtSelection(html) {
    let sel = restoreSelection();
    let range;
    if (sel && sel.rangeCount > 0 && textarea.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else {
      sel = window.getSelection();
      range = document.createRange();
      range.selectNodeContents(textarea);
      range.collapse(false);
    }
    range.deleteContents();

    const template = document.createElement('template');
    template.innerHTML = html;
    const frag = template.content;
    const lastNode = frag.lastChild;
    range.insertNode(frag);

    if (lastNode) {
      const after = document.createRange();
      after.setStartAfter(lastNode);
      after.setEndAfter(lastNode);
      sel.removeAllRanges();
      sel.addRange(after);
      savedRange = after.cloneRange();
    }

    textarea.focus();
    window.autoSave();
  }

  /* ------------------------------------------------------------------------
     Ferramentas do editor
     ------------------------------------------------------------------------ */
  window.toggleSelect = function (id) {
    document.querySelectorAll('.tool-select').forEach(el => {
      if (el.id !== id) el.classList.add('hidden');
    });
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
  };

  window.applyFont = function (fontName) {
    if (!fontName) return;
    wrapSelectionStyle('font-family:' + fontName + ';');
    const sel = document.getElementById('selectFont');
    sel.value = '';
    sel.classList.add('hidden');
  };

  window.applyFontSize = function (px) {
    if (!px) return;
    wrapSelectionStyle('font-size:' + px + 'px;');
    const sel = document.getElementById('selectFontSize');
    sel.value = '';
    sel.classList.add('hidden');
  };

  window.applyColor = function (color) {
    wrapSelectionStyle('color:' + color + ';');
  };

  const TITLE_STYLES = {
    h1: 'font-size:29px; font-weight:800;',
    h2: 'font-size:24px; font-weight:700;',
    h3: 'font-size:20px; font-weight:600;',
    h4: 'font-size:17px; font-weight:500;'
  };

  window.applyTitle = function (level) {
    wrapSelectionStyle(TITLE_STYLES[level] || '');
  };

  window.insertTable = function () {
    const html = '<table class="note-table"><tr><td>Coluna 1</td><td>Coluna 2</td></tr>'
      + '<tr><td><br></td><td><br></td></tr></table><div><br></div>';
    insertHtmlAtSelection(html);
  };

  window.insertChecklist = function () {
    const html = '<div>☐ Item 1</div><div>☐ Item 2</div><div>☐ Item 3</div><div><br></div>';
    insertHtmlAtSelection(html);
  };

  /* ------------------------------------------------------------------------
     Exclusão (modal)
     ------------------------------------------------------------------------ */
  function requestDelete(id) {
    pendingDeleteId = id;
    deleteModal.classList.remove('hidden');
  }

  window.cancelDelete = function () {
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');
  };

  window.confirmDelete = function () {
    var id = pendingDeleteId;
    if (!id) { deleteModal.classList.add('hidden'); return Promise.resolve(); }
    var btn = deleteModal.querySelector('.btn-danger');
    return U.withBusy(btn, async function () {
      try {
        await S.notes.remove(id); // só some da tela depois que o banco confirmar
        notes = notes.filter(function (n) { return n.id !== id; });
        if (currentId === id) {
          debouncedSave.cancel();
          dirty = false; saving = false;
          currentId = null;
          editorView.classList.add('hidden');
          galleryView.classList.remove('hidden');
        }
        pendingDeleteId = null;
        deleteModal.classList.add('hidden');
        renderGallery(currentSearch());
      } catch (err) {
        U.reportError(err, 'Não foi possível excluir a nota.');
      }
    });
  };

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  carregar();
})();
