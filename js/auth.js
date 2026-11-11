/* ==========================================================================
   NIANE — auth.js
   --------------------------------------------------------------------------
   Toda a autenticação passa por aqui (Supabase Auth): cadastro, login,
   logout, recuperação/atualização de senha, consulta da sessão e
   monitoramento de mudanças. Expõe `window.NianeAuth`.

   Princípio: a identidade do usuário vem SEMPRE do servidor
   (`auth.getUser()` valida o token). Nada de confiar em dados guardados só
   no navegador — e, de qualquer forma, o banco só devolve linhas do dono
   via RLS (auth.uid()).
   ========================================================================== */
(function () {
  'use strict';

  var U = window.NianeUtils;
  var sb = window.NianeSupabase;

  // Chaves de localStorage que pertencem a UMA conta e não devem "vazar" para
  // quem entrar depois neste mesmo navegador. (Os dados reais ficam no banco.)
  var USER_LOCAL_KEYS = [
    'niane-theme', 'niane-saved-themes',
    'niane-pomodoro-state', 'niane-pomodoro-total-seconds'
  ];

  var cachedSession = null;
  var listeners = [];

  function client() {
    if (!sb) throw new U.NianeError('network', 'Não foi possível carregar o Supabase. Verifique sua conexão e recarregue a página.');
    return sb;
  }

  function pagesBaseUrl() {
    // URL absoluta da pasta /pages/ atual — usada nos links enviados por e-mail.
    var href = window.location.href.split('#')[0].split('?')[0];
    return href.slice(0, href.lastIndexOf('/') + 1);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
  }

  function validatePassword(password) {
    if (!password || password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (password.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
    return null;
  }

  /* ---- Cadastro ---- */
  async function signUp(email, password, username, receiveUpdates) {
    email = String(email || '').trim();
    username = String(username || '').trim();
    if (!validateEmail(email)) throw new U.NianeError('validation', 'Informe um e-mail válido.');
    var pwErr = validatePassword(password);
    if (pwErr) throw new U.NianeError('validation', pwErr);
    if (username.length > 60) throw new U.NianeError('validation', 'O nome de usuário pode ter no máximo 60 caracteres.');

    return U.guard(async function () {
      var res = await client().auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username, receive_updates: !!receiveUpdates },
          emailRedirectTo: pagesBaseUrl() + 'login.html'
        }
      });
      var data = U.unwrap(res);
      // Quando o e-mail já existe, o Supabase devolve um usuário sem identidades
      // (para não revelar quais e-mails estão cadastrados).
      var needsConfirmation = !(data && data.session);
      return { user: data && data.user, needsConfirmation: needsConfirmation };
    });
  }

  /* ---- Login ---- */
  async function signIn(email, password) {
    email = String(email || '').trim();
    if (!validateEmail(email)) throw new U.NianeError('validation', 'Informe um e-mail válido.');
    if (!password) throw new U.NianeError('validation', 'Informe sua senha.');
    return U.guard(async function () {
      var data = U.unwrap(await client().auth.signInWithPassword({ email: email, password: password }));
      cachedSession = data.session;
      return data;
    });
  }

  /* ---- Logout ---- */
  function clearUserLocalData() {
    USER_LOCAL_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignorado: storage indisponível */ } });
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('niane-pomodoro-pending:') === 0) localStorage.removeItem(k);
      });
    } catch (e) { /* ignorado */ }
  }

  async function signOut() {
    return U.guard(async function () {
      var res = await client().auth.signOut();
      cachedSession = null;
      clearUserLocalData();
      if (res && res.error && !/session.*missing/i.test(res.error.message || '')) U.unwrap(res);
    });
  }

  /* ---- Recuperação de senha ---- */
  async function requestPasswordReset(email) {
    email = String(email || '').trim();
    if (!validateEmail(email)) throw new U.NianeError('validation', 'Informe um e-mail válido.');
    return U.guard(async function () {
      U.unwrap(await client().auth.resetPasswordForEmail(email, {
        redirectTo: pagesBaseUrl() + 'reset-password.html'
      }));
    });
  }

  async function updatePassword(newPassword) {
    var pwErr = validatePassword(newPassword);
    if (pwErr) throw new U.NianeError('validation', pwErr);
    return U.guard(async function () {
      U.unwrap(await client().auth.updateUser({ password: newPassword }));
    });
  }

  /* ---- Sessão / usuário ---- */
  // getSession lê o token salvo (e renova se preciso); getUser valida no servidor.
  async function getSession() {
    return U.guard(async function () {
      var data = U.unwrap(await client().auth.getSession());
      cachedSession = data.session;
      return data.session;
    });
  }

  async function getVerifiedUser() {
    var session = await getSession();
    if (!session) return null;
    return U.guard(async function () {
      var res = await client().auth.getUser();
      if (res.error) {
        var e = U.toNianeError(res.error);
        if (e.kind === 'network') throw e;       // offline: não é "deslogado"
        return null;                              // token inválido/expirado
      }
      return res.data.user;
    });
  }

  function currentUserIdSync() {
    return cachedSession && cachedSession.user ? cachedSession.user.id : null;
  }

  function getCachedAccessToken() {
    return cachedSession ? cachedSession.access_token : null;
  }

  async function updateUserMetadata(meta) {
    return U.guard(async function () {
      return U.unwrap(await client().auth.updateUser({ data: meta })).user;
    });
  }

  /* ---- Mudanças de autenticação ---- */
  function onChange(fn) { listeners.push(fn); }

  if (sb) {
    sb.auth.onAuthStateChange(function (event, session) {
      cachedSession = session;
      listeners.forEach(function (fn) {
        try { fn(event, session); } catch (e) { console.error('[NIANE] listener de auth falhou', e); }
      });
    });
  }

  window.NianeAuth = {
    validateEmail: validateEmail,
    validatePassword: validatePassword,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    requestPasswordReset: requestPasswordReset,
    updatePassword: updatePassword,
    getSession: getSession,
    getVerifiedUser: getVerifiedUser,
    currentUserIdSync: currentUserIdSync,
    getCachedAccessToken: getCachedAccessToken,
    updateUserMetadata: updateUserMetadata,
    onChange: onChange
  };
})();
