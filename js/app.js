/* ==========================================================================
   NIANE — app.js
   --------------------------------------------------------------------------
   Ponto de entrada de cada página:
   1) Descobre qual página é (pelo nome do arquivo).
   2) Páginas protegidas: valida a sessão NO SERVIDOR; sem sessão, redireciona
      para o login. Páginas de login/cadastro: se já há sessão, vai para a Home.
   3) Expõe `NianeApp.ready` (Promise) — os scripts de cada página esperam por
      ela antes de buscar dados — e `NianeApp.user`.
   4) Sincroniza preferências (tema, tempos do Pomodoro) com o banco.
   ========================================================================== */
(function () {
  'use strict';

  var U = window.NianeUtils;
  var A = window.NianeAuth;

  var PROTECTED = { home: 1, lists: 1, notes: 1, pomodoro: 1, music: 1, settings: 1 };
  var GUEST_ONLY = { login: 1, register: 1 };

  var file = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '') || 'index';
  var page = file;

  var app = { page: page, user: null, ready: null, loginUrl: 'login.html', homeUrl: 'home.html' };
  window.NianeApp = app;

  var isProtected = !!PROTECTED[page];
  var isGuestOnly = !!GUEST_ONLY[page];

  // Esconde a página protegida até a sessão ser confirmada (evita "piscar" conteúdo).
  if (isProtected) {
    U.ensureUiStyles();
    document.documentElement.classList.add('niane-auth-pending');
  }

  function showFatal(message, canRetry) {
    document.documentElement.classList.remove('niane-auth-pending');
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:var(--bg,#EAF6FB);';
    document.body.appendChild(box);
    U.renderState(box, 'error', message, canRetry ? function () { window.location.reload(); } : null);
  }

  function goToLogin() {
    var here = page + '.html' + window.location.search;
    window.location.replace(app.loginUrl + (isProtected ? '?next=' + encodeURIComponent(here) : ''));
  }

  /* ---------------- Sincronização de preferências ---------------- */
  var applyingRemote = false;
  var prefs = {
    themeChanged: function () {},    // trocado abaixo
    pomodoroChanged: function () {}
  };
  window.NianePrefs = prefs;

  function currentThemePayload() {
    var T = window.NianeTheme;
    if (!T) return null;
    var palette = T.loadSavedPalette();
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem('niane-saved-themes')) || []; } catch (e) { saved = []; }
    return palette ? { palette: palette, saved: saved } : null;
  }

  function domReady() {
    return new Promise(function (resolve) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve);
      else resolve();
    });
  }

  function setupPreferenceSync() {
    var P = window.NianeServices.profile;

    var saveThemeSoon = U.debounce(function () {
      if (applyingRemote) return;
      var payload = currentThemePayload();
      if (!payload) return;
      P.saveSettings({ theme: payload }).catch(function (e) { U.reportError(e); });
    }, 800);
    prefs.themeChanged = saveThemeSoon;
    if (window.NianeTheme && window.NianeTheme.onChange) window.NianeTheme.onChange(saveThemeSoon);

    var savePomodoroSoon = U.debounce(function (vals) {
      if (applyingRemote) return;
      P.saveSettings(vals).catch(function (e) { U.reportError(e); });
    }, 600);
    prefs.pomodoroChanged = function (state) {
      savePomodoroSoon({
        focus_duration: state.focusMinutes,
        short_break_duration: state.breakMinutes,
        long_break_duration: state.longBreakMinutes,
        total_cycles: state.totalCycles
      });
    };

    // Carrega as preferências do servidor e aplica na página.
    return Promise.all([P.getSettings(), domReady()]).then(function (res) {
      var s = res[0];
      if (!s) return;
      applyingRemote = true;
      try {
        var T = window.NianeTheme;
        var remote = s.theme;
        if (remote && remote.palette && remote.palette.bg && T) {
          T.applyPalette(remote.palette);
          try { localStorage.setItem(T.THEME_KEY, JSON.stringify(remote.palette)); } catch (e) { /* storage indisponível */ }
          if (Array.isArray(remote.saved)) {
            try { localStorage.setItem('niane-saved-themes', JSON.stringify(remote.saved)); } catch (e) { /* storage indisponível */ }
          }
        } else if (!remote && T && T.loadSavedPalette()) {
          // conta nova: envia o tema que a pessoa já usava neste navegador
          applyingRemote = false; saveThemeSoon(); applyingRemote = true;
        }
        var N = window.NianePomodoro;
        if (N && N.applyRemoteSettings) {
          N.applyRemoteSettings({
            focusMinutes: s.focus_duration, breakMinutes: s.short_break_duration,
            longBreakMinutes: s.long_break_duration, totalCycles: s.total_cycles
          });
        }
      } finally { applyingRemote = false; }
    }).catch(function (e) {
      console.warn('[NIANE] não foi possível carregar as preferências', e);
      if (e && e.kind === 'network') U.toast('Sem conexão: usando as preferências salvas neste navegador.', 'info');
    });
  }

  /* ---------------- Inicialização ---------------- */
  app.ready = (async function () {
    if (!window.NianeSupabase) {
      if (isProtected) showFatal('Não foi possível carregar o NIANE. Verifique sua conexão e tente de novo.', true);
      throw new U.NianeError('network', 'Supabase indisponível.');
    }

    var user = null;
    try {
      user = await A.getVerifiedUser();
    } catch (err) {
      if (isProtected) {
        showFatal(err && err.message ? err.message : 'Erro de conexão.', true);
      }
      throw err; // erro de rede/servidor: NÃO redireciona como se estivesse deslogado
    }

    if (isGuestOnly && user) { window.location.replace(app.homeUrl); return new Promise(function () {}); }
    if (isProtected && !user) { goToLogin(); return new Promise(function () {}); }

    app.user = user;
    if (isProtected) {
      document.documentElement.classList.remove('niane-auth-pending');
      setupPreferenceSync();
    }

    // Sessão encerrada/expirada em qualquer momento (inclusive em outra aba).
    A.onChange(function (event) {
      if (event === 'SIGNED_OUT' && isProtected) goToLogin();
    });

    document.dispatchEvent(new CustomEvent('niane:ready', { detail: { user: user } }));
    return user;
  })();

  // Evita "unhandled rejection" nas páginas que não escutam a Promise.
  app.ready.catch(function () { /* já tratado acima (tela de erro/redirecionamento) */ });
})();
