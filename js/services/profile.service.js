/* ==========================================================================
   NIANE — services/profile.service.js
   Perfil (tabela profiles) e preferências (tabela user_settings).
   Expõe `NianeServices.profile`.
   ========================================================================== */
(function () {
  'use strict';
  var U = window.NianeUtils;
  var sb = window.NianeSupabase;
  window.NianeServices = window.NianeServices || {};

  var SETTINGS_FIELDS = ['theme', 'focus_duration', 'short_break_duration', 'long_break_duration', 'total_cycles'];

  async function requireUserId() {
    var user = await window.NianeAuth.getVerifiedUser();
    if (!user) throw new U.NianeError('auth', 'Sua sessão expirou. Entre novamente.');
    return user.id;
  }

  async function getProfile() {
    return U.guard(async function () {
      var id = await requireUserId();
      return U.unwrap(await sb.from('profiles').select('id, username, full_name, avatar_url, updated_at').eq('id', id).maybeSingle());
    });
  }

  async function updateProfile(patch) {
    var clean = {};
    if ('username' in patch) {
      var u = String(patch.username || '').trim();
      if (u.length > 60) throw new U.NianeError('validation', 'O nome de usuário pode ter no máximo 60 caracteres.');
      clean.username = u || null;
    }
    if ('full_name' in patch) {
      var f = String(patch.full_name || '').trim();
      if (f.length > 120) throw new U.NianeError('validation', 'O nome completo pode ter no máximo 120 caracteres.');
      clean.full_name = f || null;
    }
    if ('avatar_url' in patch) clean.avatar_url = patch.avatar_url || null;
    return U.guard(async function () {
      var id = await requireUserId();
      var row = U.unwrap(await sb.from('profiles').update(clean).eq('id', id).select('id, username, full_name, avatar_url').maybeSingle());
      if (!row) {
        // perfil ausente (conta antiga): cria
        row = U.unwrap(await sb.from('profiles').insert(Object.assign({ id: id }, clean)).select('id, username, full_name, avatar_url').single());
      }
      return row;
    });
  }

  async function getSettings() {
    return U.guard(async function () {
      var id = await requireUserId();
      return U.unwrap(await sb.from('user_settings')
        .select('theme, focus_duration, short_break_duration, long_break_duration, total_cycles').eq('user_id', id).maybeSingle());
    });
  }

  /* Atualiza só os campos informados. Se a linha ainda não existir, cria. */
  async function saveSettings(patch) {
    var clean = {};
    SETTINGS_FIELDS.forEach(function (k) { if (k in patch) clean[k] = patch[k]; });
    function checkRange(key, min, max, label) {
      if (key in clean) {
        var n = Number(clean[key]);
        if (!Number.isInteger(n) || n < min || n > max) {
          throw new U.NianeError('validation', label + ' deve ser um número inteiro entre ' + min + ' e ' + max + '.');
        }
        clean[key] = n;
      }
    }
    checkRange('focus_duration', 1, 240, 'O tempo de foco');
    checkRange('short_break_duration', 1, 120, 'A pausa curta');
    checkRange('long_break_duration', 1, 240, 'A pausa longa');
    checkRange('total_cycles', 1, 20, 'O número de ciclos');
    if (!Object.keys(clean).length) return null;

    return U.guard(async function () {
      var id = await requireUserId();
      var row = U.unwrap(await sb.from('user_settings').update(clean).eq('user_id', id).select('user_id').maybeSingle());
      if (!row) {
        U.unwrap(await sb.from('user_settings').insert(Object.assign({ user_id: id }, clean)));
      }
      return clean;
    });
  }

  window.NianeServices.profile = {
    getProfile: getProfile,
    updateProfile: updateProfile,
    getSettings: getSettings,
    saveSettings: saveSettings
  };
})();
