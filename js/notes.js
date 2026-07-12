/* ==========================================================================
   NIANE — notes.js
   --------------------------------------------------------------------------
   A área de edição agora é uma div "contenteditable" (em vez de <textarea>),
   porque um textarea não suporta estilos diferentes dentro do mesmo campo —
   qualquer CSS aplicado nele vale para o texto inteiro.

   Com contenteditable, cada formatação (Fonte, Tamanho, Cor, Título) é
   aplicada envolvendo apenas o TRECHO SELECIONADO em um <span> com o estilo
   correspondente, preservando o resto do texto como estava.

     - Galeria de notas (cards, busca, criar, excluir)
     - Editor rich-text simples: formatação por seleção
     - Tabela e lista de tarefas são inseridas como HTML na posição do cursor
     - Autosave (debounced) em localStorage, guardando o innerHTML da nota
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'niane-notes';

  const galleryView = document.getElementById('viewGallery');
  const editorView = document.getElementById('viewEditor');
  const notesGrid = document.getElementById('notesGrid');
  const titleInput = document.getElementById('noteTitleInput');
  const textarea = document.getElementById('noteTextarea'); // div contenteditable
  const saveStatus = document.getElementById('saveStatus');
  const deleteModal = document.getElementById('deleteModal');

  let notes = loadNotes();
  let currentId = null;
  let pendingDeleteId = null;
  let saveTimer = null;
  let savedRange = null; // última seleção de texto feita dentro do editor

  function loadNotes() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function htmlToText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /* ------------------------------------------------------------------------
     Galeria
     ------------------------------------------------------------------------ */
  function renderGallery(filter) {
    const term = (filter || '').trim().toLowerCase();
    const list = notes
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter(n => !term || (n.title + ' ' + htmlToText(n.content)).toLowerCase().includes(term));

    if (!list.length) {
      notesGrid.innerHTML = `<p style="color:#88b0c2;font-size:0.85rem;padding:8px 4px;">
        ${notes.length ? 'Nenhuma nota encontrada.' : 'Você ainda não tem notas. Crie a primeira abaixo!'}
      </p>`;
      return;
    }

    notesGrid.innerHTML = list.map(n => `
      <div class="note-card" data-id="${n.id}">
        <div class="note-card-title">${escapeHtml(n.title || 'Sem título')}</div>
        <div class="note-card-preview">${escapeHtml(htmlToText(n.content))}</div>
        <div class="note-card-footer">
          <span class="note-card-date">${formatDate(n.updatedAt)}</span>
          <button class="btn-delete-card" title="Excluir nota">🗑️</button>
        </div>
      </div>
    `).join('');

    notesGrid.querySelectorAll('.note-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.addEventListener('click', () => openNote(id));
      card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
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
    const note = notes.find(n => n.id === id);
    if (!note) return;
    currentId = id;
    titleInput.value = note.title || '';
    textarea.innerHTML = note.content || '';
    savedRange = null;
    galleryView.classList.add('hidden');
    editorView.classList.remove('hidden');
    saveStatus.textContent = '💾 Salvo';
    textarea.focus();
  }

  window.newNote = function () {
    const note = { id: 'n' + Date.now(), title: '', content: '', updatedAt: Date.now() };
    notes.push(note);
    persist();
    openNote(note.id);
  };

  window.backToGallery = function () {
    editorView.classList.add('hidden');
    galleryView.classList.remove('hidden');
    currentId = null;
    renderGallery(document.querySelector('.search-input') ? document.querySelector('.search-input').value : '');
  };

  window.autoSave = function () {
    if (!currentId) return;
    saveStatus.textContent = '💾 Salvando...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const note = notes.find(n => n.id === currentId);
      if (!note) return;
      note.title = titleInput.value;
      note.content = textarea.innerHTML;
      note.updatedAt = Date.now();
      persist();
      saveStatus.textContent = '💾 Salvo';
    }, 500);
  };

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
    if (pendingDeleteId) {
      notes = notes.filter(n => n.id !== pendingDeleteId);
      persist();
      if (currentId === pendingDeleteId) {
        currentId = null;
        editorView.classList.add('hidden');
        galleryView.classList.remove('hidden');
      }
    }
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');
    renderGallery();
  };

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => renderGallery());
  if (document.readyState !== 'loading') renderGallery();
})();
