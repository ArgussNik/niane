(function () {
  'use strict';

  const overlay = document.getElementById('overlay');
  const popupConfig = document.getElementById('popupConfig');
  const openConfig = document.getElementById('openConfig');
  const closeConfig = document.getElementById('closeConfig');
  const popupUsuario = document.getElementById('popupUsuario');
  const openUsuario = document.getElementById('openUsuario');
  const closeUsuario = document.getElementById('closeUsuario');
  const popupTemasSalvos = document.getElementById('popupTemasSalvos');
  const btnTemasSalvos = document.getElementById('btnTemasSalvos');
  const closeTemasSalvos = document.getElementById('closeTemasSalvos');
  const voltarConfig = document.getElementById('voltarConfig');
  const savedGrid = document.getElementById('savedGrid');
  const inputBg = document.getElementById('inputBg');
  const inputTexto = document.getElementById('inputTexto');
  const inputAccent = document.getElementById('inputAccent');
  const inputAccent2 = document.getElementById('inputAccent2');

  function preencherInputsComTemaAtual() {
    const cs = getComputedStyle(document.documentElement);
    const bgAtual = (cs.getPropertyValue('--bg-site') || cs.getPropertyValue('--bg')).trim();
    const textoAtual = (cs.getPropertyValue('--cor-primaria') || cs.getPropertyValue('--text')).trim();
    const accentAtual = cs.getPropertyValue('--accent2').trim();
    const accent2Atual = cs.getPropertyValue('--accent3').trim();
    if (inputBg && bgAtual) inputBg.value = bgAtual;
    if (inputTexto && textoAtual) inputTexto.value = textoAtual;
    if (inputAccent && accentAtual) inputAccent.value = accentAtual;
    if (inputAccent2 && accent2Atual) inputAccent2.value = accent2Atual;
  }

  function fecharTodos() {
    [popupConfig, popupUsuario, popupTemasSalvos].forEach((popup) => {
      if (popup) popup.classList.remove('active');
    });
    if (overlay) overlay.classList.remove('active');
  }

  function abrirPopup(popup) {
    fecharTodos();
    if (popup) popup.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function mudarCor(fundo, texto, accentBase, accentBase2) {
    if (!accentBase) {
      accentBase = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#3AADD4';
    }
    if (!accentBase2) accentBase2 = accentBase;
    if (window.NianeTheme) {
      window.NianeTheme.applyTheme(fundo, texto, accentBase, accentBase2);
    } else {
      document.documentElement.style.setProperty('--bg-site', fundo);
      document.documentElement.style.setProperty('--cor-primaria', texto);
    }
    if (inputBg) inputBg.value = fundo;
    if (inputTexto) inputTexto.value = texto;
    if (inputAccent) inputAccent.value = accentBase;
    if (inputAccent2) inputAccent2.value = accentBase2;
  }

  window.mudarCor = mudarCor;

  function aplicarDosInputs() {
    mudarCor(inputBg?.value || '', inputTexto?.value || '', inputAccent?.value || '', inputAccent2?.value || '');
  }

  if (openConfig) openConfig.addEventListener('click', () => abrirPopup(popupConfig));
  if (openUsuario) openUsuario.addEventListener('click', () => abrirPopup(popupUsuario));
  if (closeConfig) closeConfig.addEventListener('click', fecharTodos);
  if (closeUsuario) closeUsuario.addEventListener('click', fecharTodos);
  if (closeTemasSalvos) closeTemasSalvos.addEventListener('click', fecharTodos);
  if (voltarConfig) voltarConfig.addEventListener('click', () => abrirPopup(popupConfig));
  if (overlay) overlay.addEventListener('click', fecharTodos);

  if (inputBg) inputBg.addEventListener('input', aplicarDosInputs);
  if (inputTexto) inputTexto.addEventListener('input', aplicarDosInputs);
  if (inputAccent) inputAccent.addEventListener('input', aplicarDosInputs);
  if (inputAccent2) inputAccent2.addEventListener('input', aplicarDosInputs);

  const SAVED_THEMES_KEY = 'niane-saved-themes';
  function getSavedThemes() {
    try { return JSON.parse(localStorage.getItem(SAVED_THEMES_KEY)) || []; } catch (e) { return []; }
  }
  function setSavedThemes(lista) {
    try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(lista)); } catch (e) {}
  }

  function renderSavedThemes() {
    const lista = getSavedThemes();
    if (savedGrid) savedGrid.innerHTML = '';
    if (!lista.length) {
      if (savedGrid) savedGrid.innerHTML = '<p class="saved-empty">Nenhum tema salvo ainda. Crie um tema acima e clique em "Salvar tema".</p>';
      return;
    }
    lista.forEach((t, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'saved-swatch';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-apply';
      btn.title = `Tema ${i + 1}`;
      btn.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`;
      btn.addEventListener('click', () => {
        mudarCor(t.bg, t.text, t.accent, t.accent2);
        fecharTodos();
      });
      wrap.appendChild(btn);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'swatch-del';
      del.title = 'Apagar tema';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const atual = getSavedThemes();
        atual.splice(i, 1);
        setSavedThemes(atual);
        renderSavedThemes();
      });
      wrap.appendChild(del);

      if (savedGrid) savedGrid.appendChild(wrap);
    });
  }

  const btnSalvarTema = document.getElementById('btnSalvarTema');
  if (btnSalvarTema) {
    btnSalvarTema.addEventListener('click', () => {
      const novo = {
        bg: inputBg?.value || '',
        text: inputTexto?.value || '',
        accent: inputAccent?.value || '',
        accent2: inputAccent2?.value || ''
      };
      const lista = getSavedThemes();
      lista.push(novo);
      setSavedThemes(lista);
      const textoOriginal = btnSalvarTema.textContent;
      btnSalvarTema.textContent = '✓ Salvo!';
      setTimeout(() => { btnSalvarTema.textContent = textoOriginal; }, 1200);
    });
  }

  if (btnTemasSalvos) {
    btnTemasSalvos.addEventListener('click', () => {
      renderSavedThemes();
      abrirPopup(popupTemasSalvos);
    });
  }

  preencherInputsComTemaAtual();
})();
