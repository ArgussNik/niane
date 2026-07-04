/* ══════════════════════════════════════════
   NIANE — notes.js
   Gerencia: galeria, editor, localStorage
══════════════════════════════════════════ */

const STORAGE_KEY = 'niane_notes';

// ── Estado ──
let notes = loadNotes();
let currentId = null;  // id da nota aberta no editor
let pendingDeleteId = null;
let saveTimer = null;

// ── Elementos ──
const viewGallery  = document.getElementById('viewGallery');
const viewEditor   = document.getElementById('viewEditor');
const notesGrid    = document.getElementById('notesGrid');
const noteTextarea = document.getElementById('noteTextarea');
const noteTitleInput = document.getElementById('noteTitleInput');
const saveStatus   = document.getElementById('saveStatus');
const deleteModal  = document.getElementById('deleteModal');

// ── Init ──
renderGallery();

/* ════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════ */
function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/* ════════════════════════════════
   GALERIA
════════════════════════════════ */
function renderGallery(filter = '') {
  notesGrid.innerHTML = '';

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(filter.toLowerCase()) ||
    n.content.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    notesGrid.innerHTML = `
      <div style="grid-column:1/-1; color:#88b8cc; font-size:0.88rem; padding:12px 0;">
        Nenhuma nota encontrada.
      </div>`;
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-card-title">${escapeHtml(note.title) || 'Sem título'}</div>
      <div class="note-card-preview">${escapeHtml(note.content) || 'Nota vazia...'}</div>
      <div class="note-card-footer">
        <span class="note-card-date">${formatDate(note.updatedAt)}</span>
        <button class="btn-delete-card" title="Excluir nota">🗑</button>
      </div>
    `;

    // Abrir editor ao clicar no card (exceto no botão excluir)
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-card')) return;
      openEditor(note.id);
    });

    // Excluir
    card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      askDelete(note.id);
    });

    notesGrid.appendChild(card);
  });
}

function filterNotes(value) {
  renderGallery(value);
}

/* ════════════════════════════════
   CRIAR NOVA NOTA
════════════════════════════════ */
function newNote() {
  const note = {
    id: Date.now().toString(),
    title: '',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.unshift(note);
  saveNotes();
  openEditor(note.id);
}

/* ════════════════════════════════
   EDITOR
════════════════════════════════ */
function openEditor(id) {
  currentId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;

  noteTitleInput.value = note.title;
  noteTextarea.value   = note.content;
  noteTextarea.style.fontFamily = 'Arial, Helvetica, sans-serif';
  noteTextarea.style.fontSize   = '0.95rem';
  noteTextarea.style.color      = '#333';

  setStatus('💾 Salvo');

  viewGallery.classList.add('hidden');
  viewEditor.classList.remove('hidden');

  noteTextarea.focus();
}

function backToGallery() {
  forceSave();
  currentId = null;
  viewEditor.classList.add('hidden');
  viewGallery.classList.remove('hidden');
  renderGallery();
}

// Salva com debounce enquanto o usuário digita
function autoSave() {
  setStatus('✏️ Editando...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(forceSave, 1200);
}

function forceSave() {
  if (!currentId) return;
  const note = notes.find(n => n.id === currentId);
  if (!note) return;

  note.title     = noteTitleInput.value;
  note.content   = noteTextarea.value;
  note.updatedAt = new Date().toISOString();

  saveNotes();
  setStatus('💾 Salvo');
}

function setStatus(msg) {
  saveStatus.textContent = msg;
}

/* ════════════════════════════════
   FERRAMENTAS DO EDITOR
════════════════════════════════ */
function toggleSelect(id) {
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
}

function applyFont(font) {
  noteTextarea.style.fontFamily = font;
  document.getElementById('selectFont').classList.add('hidden');
  noteTextarea.focus();
}

const titleSizes = { h1: '2rem', h2: '1.5rem', h3: '1.17rem', h4: '1rem' };

function applyTitle(level) {
  noteTextarea.style.fontSize = titleSizes[level];
  noteTextarea.focus();
}

function applyColor(color) {
  noteTextarea.style.color = color;
}

function insertTable() {
  const table = '\n| Coluna 1 | Coluna 2 |\n|----------|----------|\n| Dado 1   | Dado 2   |\n';
  insertAtCursor(table);
}

function insertChecklist() {
  insertAtCursor('\n[ ] ');
}

function insertAtCursor(text) {
  const start = noteTextarea.selectionStart;
  const end   = noteTextarea.selectionEnd;
  const val   = noteTextarea.value;
  noteTextarea.value = val.slice(0, start) + text + val.slice(end);
  noteTextarea.selectionStart = noteTextarea.selectionEnd = start + text.length;
  noteTextarea.focus();
  autoSave();
}

/* ════════════════════════════════
   EXCLUSÃO
════════════════════════════════ */
function askDelete(id) {
  pendingDeleteId = id;
  deleteModal.classList.remove('hidden');
}

function cancelDelete() {
  pendingDeleteId = null;
  deleteModal.classList.add('hidden');
}

function confirmDelete() {
  notes = notes.filter(n => n.id !== pendingDeleteId);
  saveNotes();
  pendingDeleteId = null;
  deleteModal.classList.add('hidden');
  renderGallery();
}

/* ════════════════════════════════
   UTILS
════════════════════════════════ */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Salvar ao sair da aba
window.addEventListener('beforeunload', () => {
  if (currentId) forceSave();
});
