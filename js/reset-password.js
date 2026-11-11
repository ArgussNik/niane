/* ==========================================================================
   NIANE — reset-password.js
   Tela aberta pelo link de recuperação enviado por e-mail. O supabase-js lê o
   token do link (detectSessionInUrl) e cria uma sessão temporária de
   "recuperação"; só com ela é possível definir a nova senha.
   ========================================================================== */
(function () {
  'use strict';

  var U = window.NianeUtils;
  var A = window.NianeAuth;

  var carregando = document.getElementById('resetCarregando');
  var invalido = document.getElementById('resetInvalido');
  var form = document.getElementById('resetForm');

  function mostrar(qual) {
    carregando.hidden = qual !== 'carregando';
    invalido.hidden = qual !== 'invalido';
    form.hidden = qual !== 'form';
  }

  var decidido = false;
  function decidir(temSessao) {
    if (decidido) return;
    decidido = true;
    mostrar(temSessao ? 'form' : 'invalido');
  }

  // O evento PASSWORD_RECOVERY chega depois que o supabase-js processa o link.
  A.onChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') decidir(true);
  });

  // Se o link já foi processado antes do listener existir, a sessão já está lá.
  setTimeout(async function () {
    try {
      var session = await A.getSession();
      var veioDeLink = /type=recovery|access_token=|code=/.test(window.location.hash + window.location.search);
      decidir(!!session && veioDeLink);
    } catch (err) {
      decidir(false);
      U.reportError(err);
    }
  }, 1200);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var nova = document.getElementById('novaSenha').value;
    var confirma = document.getElementById('confirmaSenha').value;
    if (nova !== confirma) { U.toast('As senhas não conferem.', 'error'); return; }
    U.withBusy(form.querySelector('.btn-submit'), async function () {
      try {
        await A.updatePassword(nova);
        U.toast('Senha alterada com sucesso!', 'success');
        setTimeout(function () { window.location.href = 'home.html'; }, 1200);
      } catch (err) {
        U.reportError(err, 'Não foi possível alterar a senha.');
      }
    });
  });
})();
