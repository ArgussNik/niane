/* ==========================================================================
   NIANE — utils.js
   --------------------------------------------------------------------------
   Funções de apoio compartilhadas: escape/sanitização, debounce, erros
   padronizados, avisos (toast) e estados visuais (carregando/vazio/erro).
   Expõe `window.NianeUtils`.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Texto e HTML seguros
     ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Sanitizador de HTML das notas (lista de permissões).
     O editor guarda HTML (spans com estilo, tabelas, divs). Antes de gravar
     no banco E antes de exibir no editor, o conteúdo passa por aqui:
     - só tags conhecidas sobrevivem (o resto é "desembrulhado" em texto);
     - script/style/iframe/etc. são removidos por completo;
     - atributos: apenas `class="note-table"` e um `style` filtrado;
     - eventos (onclick...), javascript: e url() em CSS nunca passam.
     Usa DOMParser, que cria um documento inerte (nada executa durante a análise). */
  var NOTE_ALLOWED_TAGS = {
    DIV: 1, SPAN: 1, P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, UL: 1, OL: 1, LI: 1,
    TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1
  };
  var NOTE_DROP_WITH_CONTENT = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1,
    NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, MATH: 1, FORM: 1, TEXTAREA: 1, SELECT: 1, BUTTON: 1
  };
  var NOTE_ALLOWED_CSS = {
    'font-family': /^[\w\s,'"\-]+$/,
    'font-size': /^\d{1,3}(\.\d+)?(px|em|rem|%)$/,
    'font-weight': /^(normal|bold|bolder|lighter|[1-9]00)$/,
    'font-style': /^(normal|italic)$/,
    'text-decoration': /^(none|underline|line-through)$/,
    'color': /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-zA-Z]+)$/,
    'text-align': /^(left|right|center|justify)$/
  };

  function sanitizeStyle(styleText) {
    var out = [];
    String(styleText || '').split(';').forEach(function (rule) {
      var i = rule.indexOf(':');
      if (i === -1) return;
      var prop = rule.slice(0, i).trim().toLowerCase();
      var val = rule.slice(i + 1).trim();
      var re = NOTE_ALLOWED_CSS[prop];
      if (re && val && re.test(val) && !/url\(|expression|javascript:|@import/i.test(val)) {
        out.push(prop + ': ' + val);
      }
    });
    return out.length ? out.join('; ') + ';' : '';
  }

  function sanitizeNode(node, doc) {
    var child = node.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 1) { // elemento
        var tag = child.tagName.toUpperCase();
        if (NOTE_DROP_WITH_CONTENT[tag]) {
          node.removeChild(child);
        } else if (!NOTE_ALLOWED_TAGS[tag]) {
          sanitizeNode(child, doc);
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        } else {
          var keepStyle = sanitizeStyle(child.getAttribute('style'));
          var keepNoteTable = tag === 'TABLE' && child.getAttribute('class') === 'note-table';
          Array.prototype.slice.call(child.attributes).forEach(function (a) {
            child.removeAttribute(a.name);
          });
          if (keepStyle) child.setAttribute('style', keepStyle);
          if (keepNoteTable) child.setAttribute('class', 'note-table');
          sanitizeNode(child, doc);
        }
      } else if (child.nodeType !== 3) { // comentários, CDATA etc.
        node.removeChild(child);
      }
      child = next;
    }
  }

  function sanitizeNoteHtml(html) {
    if (!html) return '';
    var doc = new DOMParser().parseFromString('<body>' + String(html), 'text/html');
    sanitizeNode(doc.body, doc);
    return doc.body.innerHTML;
  }

  function htmlToText(html) {
    if (!html) return '';
    var doc = new DOMParser().parseFromString('<body>' + String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------------
     Debounce com flush/cancel (autosave)
     ------------------------------------------------------------------------ */
  function debounce(fn, wait) {
    var timer = null, lastArgs = null;
    function run() { timer = null; var a = lastArgs; lastArgs = null; return fn.apply(null, a || []); }
    function debounced() {
      lastArgs = arguments;
      clearTimeout(timer);
      timer = setTimeout(run, wait);
    }
    debounced.flush = function () { if (timer) { clearTimeout(timer); return run(); } };
    debounced.cancel = function () { clearTimeout(timer); timer = null; lastArgs = null; };
    debounced.pending = function () { return timer !== null; };
    return debounced;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ------------------------------------------------------------------------
     Erros padronizados
     Todo erro vindo do Supabase/rede vira um NianeError com:
       kind: 'network' | 'auth' | 'validation' | 'permission' | 'notfound' | 'conflict' | 'unknown'
       message: texto amigável em português (pode ir direto para o usuário)
     ------------------------------------------------------------------------ */
  function NianeError(kind, message, cause) {
    this.name = 'NianeError';
    this.kind = kind;
    this.message = message;
    this.cause = cause || null;
  }
  NianeError.prototype = Object.create(Error.prototype);
  NianeError.prototype.constructor = NianeError;

  var AUTH_MESSAGES = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'],
    [/user already registered|already been registered/i, 'Este e-mail já está cadastrado.'],
    [/password should be at least|weak password|password is too short/i, 'A senha é muito fraca. Use pelo menos 8 caracteres.'],
    [/same password|different from the old/i, 'A nova senha precisa ser diferente da atual.'],
    [/rate limit|too many requests|over_email_send_rate_limit/i, 'Muitas tentativas. Aguarde um pouco e tente de novo.'],
    [/invalid email|unable to validate email/i, 'E-mail inválido.'],
    [/signup.*disabled|signups not allowed/i, 'O cadastro está desativado no momento.'],
    [/jwt expired|refresh token|session.*(missing|expired|not found)|not authenticated/i, 'Sua sessão expirou. Entre novamente.']
  ];

  function isNetworkError(err) {
    if (!err) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var msg = String(err.message || err);
    return err.name === 'AuthRetryableFetchError' ||
      /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(msg);
  }

  function toNianeError(err) {
    if (err instanceof NianeError) return err;
    if (!err) return new NianeError('unknown', 'Ocorreu um erro inesperado.');
    var msg = String(err.message || err);
    var code = String(err.code || '');
    var status = err.status || 0;

    if (isNetworkError(err)) {
      return new NianeError('network', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.', err);
    }
    // Erros do Supabase Auth
    if (err.name && /^Auth/.test(err.name) || err.__isAuthError) {
      for (var i = 0; i < AUTH_MESSAGES.length; i++) {
        if (AUTH_MESSAGES[i][0].test(msg)) {
          var kind = /rate limit|too many/i.test(msg) ? 'validation' :
            /already registered|invalid email|password|same password/i.test(msg) ? 'validation' : 'auth';
          return new NianeError(kind, AUTH_MESSAGES[i][1], err);
        }
      }
      return new NianeError('auth', 'Não foi possível concluir a autenticação. ' + msg, err);
    }
    // Erros do PostgREST/Postgres
    if (code === '42501' || status === 401 || status === 403 || /row-level security|permission denied/i.test(msg)) {
      if (status === 401 || /jwt/i.test(msg)) return new NianeError('auth', 'Sua sessão expirou. Entre novamente.', err);
      return new NianeError('permission', 'Você não tem permissão para fazer isso.', err);
    }
    if (code === 'PGRST116' || status === 404) return new NianeError('notfound', 'Registro não encontrado (pode ter sido excluído).', err);
    if (code === '23505' || status === 409) return new NianeError('conflict', 'Conflito: este registro já existe ou foi alterado.', err);
    if (code === '23514' || code === '23502' || code === '22001' || code === '22007' || code === '22P02' || code === '23503') {
      return new NianeError('validation', 'Dados inválidos. Confira os campos e tente novamente.', err);
    }
    if (/jwt|not authenticated/i.test(msg)) return new NianeError('auth', 'Sua sessão expirou. Entre novamente.', err);
    return new NianeError('unknown', 'Ocorreu um erro ao falar com o servidor. Tente novamente.', err);
  }

  /* Recebe a resposta { data, error } do supabase-js: devolve `data` ou lança NianeError. */
  function unwrap(result) {
    if (result && result.error) {
      var e = toNianeError(result.error);
      console.error('[NIANE]', e.kind, result.error);
      throw e;
    }
    return result ? result.data : null;
  }

  /* Executa uma chamada que pode lançar (ex.: rede) e padroniza o erro. */
  async function guard(promiseFactory) {
    try {
      return await promiseFactory();
    } catch (err) {
      if (err instanceof NianeError) throw err;
      var e = toNianeError(err);
      console.error('[NIANE]', e.kind, err);
      throw e;
    }
  }

  /* ------------------------------------------------------------------------
     Interface: estilos, toast, estados e botões ocupados
     ------------------------------------------------------------------------ */
  function ensureUiStyles() {
    if (document.getElementById('niane-ui-styles')) return;
    var st = document.createElement('style');
    st.id = 'niane-ui-styles';
    st.textContent =
      '#niane-toasts{position:fixed;top:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;max-width:min(92vw,360px);pointer-events:none;}' +
      '.niane-toast{pointer-events:auto;background:var(--surface,#fff);color:var(--text,#1a2b35);border:1.5px solid var(--accent-soft,#B2E6F5);' +
      'border-left-width:5px;border-radius:12px;padding:10px 14px;font:500 .88rem/1.35 "DM Sans",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.15);' +
      'opacity:0;transform:translateY(-6px);transition:opacity .2s,transform .2s;}' +
      '.niane-toast.niane-in{opacity:1;transform:none;}' +
      '.niane-toast.niane-success{border-left-color:#2e9e5b;}' +
      '.niane-toast.niane-error{border-left-color:#c94b4b;}' +
      '.niane-toast.niane-info{border-left-color:var(--accent2,#3AADD4);}' +
      '.niane-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;' +
      'padding:28px 16px;color:var(--text-muted,#6b8fa0);font:500 .9rem/1.4 "DM Sans",system-ui,sans-serif;}' +
      '.niane-state.niane-state-error{color:#b03a3a;}' +
      '.niane-state button{border:none;border-radius:999px;padding:8px 18px;cursor:pointer;font:700 .82rem "DM Sans",system-ui,sans-serif;' +
      'color:#fff;background:var(--accent2,#3AADD4);}' +
      '.niane-spinner{width:22px;height:22px;border:3px solid var(--accent-soft,#B2E6F5);border-top-color:var(--accent2,#3AADD4);' +
      'border-radius:50%;animation:niane-spin .8s linear infinite;}' +
      '@keyframes niane-spin{to{transform:rotate(360deg)}}' +
      '.niane-busy{opacity:.6;pointer-events:none;cursor:progress;}' +
      'html.niane-auth-pending body{visibility:hidden;}';
    document.head.appendChild(st);
  }

  function toast(message, type, ms) {
    ensureUiStyles();
    var box = document.getElementById('niane-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'niane-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'niane-toast niane-' + (type || 'info');
    el.textContent = message; // textContent: nunca interpreta HTML
    box.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('niane-in'); });
    setTimeout(function () {
      el.classList.remove('niane-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, ms || (type === 'error' ? 5500 : 3000));
  }

  function reportError(err, fallback) {
    var e = toNianeError(err);
    toast(e.message || fallback || 'Ocorreu um erro.', 'error');
    return e;
  }

  /* Substitui o conteúdo de `container` por um estado visual. */
  function renderState(container, kind, message, onRetry) {
    if (!container) return;
    ensureUiStyles();
    container.textContent = '';
    var box = document.createElement('div');
    box.className = 'niane-state' + (kind === 'error' ? ' niane-state-error' : '');
    if (kind === 'loading') {
      var sp = document.createElement('div'); sp.className = 'niane-spinner'; box.appendChild(sp);
    }
    var p = document.createElement('p'); p.style.margin = '0'; p.textContent = message; box.appendChild(p);
    if (kind === 'error' && typeof onRetry === 'function') {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Tentar de novo';
      b.addEventListener('click', onRetry); box.appendChild(b);
    }
    container.appendChild(box);
  }

  /* Evita cliques/envios duplos: roda `fn` com o botão travado. */
  async function withBusy(button, fn) {
    if (button && button.dataset.nianeBusy === '1') return undefined;
    if (button) { button.dataset.nianeBusy = '1'; button.classList.add('niane-busy'); button.disabled = true; }
    try { return await fn(); }
    finally {
      if (button) { delete button.dataset.nianeBusy; button.classList.remove('niane-busy'); button.disabled = false; }
    }
  }

  function formatDateBR(value) {
    var d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  window.NianeUtils = {
    escapeHtml: escapeHtml,
    sanitizeNoteHtml: sanitizeNoteHtml,
    htmlToText: htmlToText,
    debounce: debounce,
    uuid: uuid,
    NianeError: NianeError,
    toNianeError: toNianeError,
    isNetworkError: isNetworkError,
    unwrap: unwrap,
    guard: guard,
    ensureUiStyles: ensureUiStyles,
    toast: toast,
    reportError: reportError,
    renderState: renderState,
    withBusy: withBusy,
    formatDateBR: formatDateBR
  };
})();
