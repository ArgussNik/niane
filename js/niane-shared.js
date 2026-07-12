/* ==========================================================================
   NIANE — niane-shared.js
   --------------------------------------------------------------------------
   Script único, incluído em todas as páginas, responsável por:

     1) Tema         — aplica e persiste (localStorage) as cores escolhidas
                        em "Configurações", em TODAS as páginas.
     2) Popups        — injeta e controla os popups de "Configurações" e
                        "Usuário" (mesmo conteúdo de Configs-Usuario.html),
                        acionados pelos itens da sidebar (id="nav-config" /
                        id="nav-usuario").
     3) Música        — mantém a música (MP3 local ou Spotify) tocando ao
                        navegar entre páginas, restaurando posição/estado
                        via localStorage + IndexedDB.

   Uso: adicione, antes de </body>, em cada página:
       <script src="niane-shared.js" defer></script>
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* ------------------------------------------------------------------------
     1) TEMA — paleta completa aplicada em todas as páginas via variáveis CSS
     ------------------------------------------------------------------------
     A derivação de cores (fundo/texto/destaque -> paleta completa: surface,
     surface2, accent-soft, text-muted etc.) mora em niane-theme-init.js, que
     é carregado no <head> de cada página ANTES do CSS, para aplicar o tema
     salvo sem flash. Aqui só reaproveitamos essa mesma lógica via
     `window.NianeTheme`, para o popup de Configurações nunca ficar
     dessincronizado do que já foi aplicado no carregamento da página — é
     isso que garante que a sidebar mude de cor em TODAS as páginas, não só
     na Home. Se por algum motivo niane-theme-init.js não tiver sido incluído
     numa página, caímos numa cópia local da mesma lógica como rede de
     segurança.
     ------------------------------------------------------------------------ */
  const THEME_KEY = 'niane-theme';
  const DEFAULT_ACCENT = '#3AADD4';

  const DEFAULT_PALETTE = {
    bg: '#EAF6FB', text: '#1a2b35',
    surface: '#ffffff', surface2: '#D8F0FA',
    accent: '#5BC4E8', accent2: '#3AADD4', accentSoft: '#B2E6F5',
    accent3: '#3AADD4', accent3Soft: '#B2E6F5',
    textMuted: '#6b8fa0'
  };

  /* ---- utilidades de cor (hex <-> rgb, mistura, brilho percebido) — rede de segurança ---- */
  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }
  function hexToRgb(hex) {
    hex = String(hex).trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 255, g: 255, b: 255 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function rgbToHex(rgb) {
    return '#' + ['r', 'g', 'b'].map(k => clamp255(rgb[k]).toString(16).padStart(2, '0')).join('');
  }
  function mix(hexA, hexB, weight) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex({
      r: a.r + (b.r - a.r) * weight,
      g: a.g + (b.g - a.g) * weight,
      b: a.b + (b.b - a.b) * weight
    });
  }
  function perceivedBrightness(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000; // 0 (escuro) – 255 (claro)
  }
  function derivePaletteFallback(bg, text, accentBase, accentBase2) {
    accentBase = accentBase || DEFAULT_ACCENT;
    accentBase2 = accentBase2 || accentBase;
    const isDark = perceivedBrightness(bg) < 128;
    const surface = isDark ? mix(bg, '#ffffff', 0.12) : '#ffffff';
    const surface2 = isDark ? mix(bg, '#ffffff', 0.20) : mix(bg, '#ffffff', 0.45);
    const accentSoft = isDark ? mix(bg, accentBase, 0.38) : mix('#ffffff', accentBase, 0.30);
    const accent3Soft = isDark ? mix(bg, accentBase2, 0.38) : mix('#ffffff', accentBase2, 0.30);
    const accent2 = accentBase;
    const accent = mix(accentBase, '#ffffff', 0.30);
    const accent3 = accentBase2;
    const textMuted = mix(text, bg, 0.42);
    return { bg, text, surface, surface2, accent, accent2, accentSoft, accent3, accent3Soft, textMuted };
  }
  function applyPaletteFallback(p) {
    const root = document.documentElement.style;
    root.setProperty('--bg', p.bg);
    root.setProperty('--bg-site', p.bg);
    root.setProperty('--text', p.text);
    root.setProperty('--cor-primaria', p.text);
    root.setProperty('--surface', p.surface);
    root.setProperty('--surface2', p.surface2);
    root.setProperty('--accent', p.accent);
    root.setProperty('--accent2', p.accent2);
    root.setProperty('--accent-soft', p.accentSoft);
    root.setProperty('--accent3', p.accent3 || p.accent2);
    root.setProperty('--accent3-soft', p.accent3Soft || p.accentSoft);
    root.setProperty('--text-muted', p.textMuted);
    root.setProperty('--text-primary', p.text);
    root.setProperty('--text-secondary', p.textMuted);
    root.setProperty('--card-bg', p.surface);
    root.setProperty('--border', p.accentSoft);
    root.setProperty('--accent-bg', p.accentSoft);
    root.setProperty('--accent-text', p.accent2);
  }

  function theme() {
    // Usa sempre a mesma instância (niane-theme-init.js) quando disponível.
    return window.NianeTheme || {
      derivePalette: derivePaletteFallback,
      applyPalette: applyPaletteFallback,
      loadSavedPalette: function () {
        try {
          const saved = JSON.parse(localStorage.getItem(THEME_KEY));
          if (saved && saved.bg && saved.text) {
            return saved.surface ? saved : derivePaletteFallback(saved.bg, saved.text, saved.accent2, saved.accent3);
          }
        } catch (e) {}
        return null;
      },
      applyTheme: function (bg, text, accentBase, accentBase2) {
        const palette = derivePaletteFallback(bg, text, accentBase, accentBase2);
        applyPaletteFallback(palette);
        try { localStorage.setItem(THEME_KEY, JSON.stringify(palette)); } catch (e) {}
        return palette;
      },
      DEFAULT_PALETTE
    };
  }

  function loadTheme() {
    const T = theme();
    T.applyPalette(T.DEFAULT_PALETTE || DEFAULT_PALETTE);
    const saved = T.loadSavedPalette();
    if (saved) T.applyPalette(saved);
  }

  function mudarCor(bg, text, accentBase, accentBase2) {
    if (!accentBase) {
      // sem cor de destaque explícita: preserva o destaque atual (ex.: ajuste fino via seletor de cor)
      accentBase = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || DEFAULT_ACCENT;
    }
    // Destaque 2 (progresso etc.): se não vier explícito, acompanha o destaque
    // principal — assim os temas prontos continuam com 1 cor só, como antes.
    if (!accentBase2) accentBase2 = accentBase;
    theme().applyTheme(bg, text, accentBase, accentBase2);
    const inputBg = document.getElementById('niane-inputBg');
    const inputTexto = document.getElementById('niane-inputTexto');
    const inputAccent = document.getElementById('niane-inputAccent');
    const inputAccent2 = document.getElementById('niane-inputAccent2');
    if (inputBg) inputBg.value = bg;
    if (inputTexto) inputTexto.value = text;
    if (inputAccent) inputAccent.value = accentBase;
    if (inputAccent2) inputAccent2.value = accentBase2;
  }
  window.mudarCor = mudarCor; // mantém compatível com onclick="mudarCor(...)"

  function ensureConstantTokens() {
    const root = document.documentElement.style;
    if (!getComputedStyle(document.documentElement).getPropertyValue('--radius')) {
      root.setProperty('--radius', '18px');
    }
    root.setProperty('--modal-overlay', 'rgba(0,0,0,0.45)');
  }

  /* ------------------------------------------------------------------------
     Fontes — garante Syne + DM Sans mesmo em páginas que não as carregam
     (Login/Registrar), para o popup/():mini-player ficarem consistentes.
     ------------------------------------------------------------------------ */
  function ensureFonts() {
    if (document.getElementById('niane-fonts')) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = '';
    const font = document.createElement('link');
    font.id = 'niane-fonts'; font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap';
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(font);
  }

  /* ------------------------------------------------------------------------
     2) POPUPS — Configurações & Usuário
     ------------------------------------------------------------------------ */
  function injectPopups() {
    if (document.getElementById('niane-overlay')) return;

    const style = document.createElement('style');
    style.id = 'niane-popup-styles';
    style.textContent = `
      #niane-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;}
      #niane-overlay.niane-active{display:block;}
      .niane-modal{display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        background:var(--surface,#fff);border:1px solid #e3eef3;z-index:1000;border-radius:var(--radius,18px);
        box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:'DM Sans',sans-serif;color:var(--text,#1a2b35);}
      .niane-modal.niane-active{display:flex;flex-direction:column;}
      #niane-popup-config.niane-active{width:90%;max-width:480px;padding:24px;max-height:85vh;overflow-y:auto;}
      #niane-popup-usuario.niane-active{align-items:stretch;width:88%;max-width:820px;min-height:360px;padding:40px;}
      #niane-popup-saved-themes.niane-active{width:90%;max-width:480px;padding:24px;max-height:85vh;overflow-y:auto;}
      .niane-heading{font-family:'Syne',sans-serif;text-align:center;margin:0;font-size:1.9rem;font-weight:800;color:var(--accent2,#3AADD4);}
      .niane-subheading{font-family:'Syne',sans-serif;text-align:center;margin:14px 0 4px;font-size:1.1rem;font-weight:700;}
      .niane-hint{text-align:center;color:var(--text-muted,#6b8fa0);margin-bottom:8px;font-size:.85rem;}
      .niane-color-options,.niane-color-classic,.niane-custom-theme-area{display:flex;justify-content:center;gap:10px;margin-top:10px;flex-wrap:wrap;}
      .niane-custom-theme-area{background:var(--surface2,#D8F0FA);padding:15px;border-radius:12px;border:1px dashed var(--accent-soft,#B2E6F5);flex-direction:column;align-items:center;}
      .niane-input-group{display:flex;align-items:center;gap:10px;margin-bottom:5px;}
      .niane-btn-color{width:38px;height:38px;border-radius:50%;border:2px solid #ddd;cursor:pointer;transition:transform .15s;padding:0;}
      .niane-btn-color:hover{transform:scale(1.12);}
      .niane-c1{background:#fce7f3;border-color:#db2777;} .niane-c2{background:#d1fae5;border-color:#059669;}
      .niane-c3{background:#2d3436;border-color:#000;} .niane-c4{background:#8f60aa;border-color:#5e3d72;}
      .niane-c5{background:#fff;border-color:#c5c5c5;} .niane-c6{background:#f0a24a;border-color:#f08000;}
      .niane-c7{background:#EAF6FB;border-color:#90deff;} .niane-c8{background:#fff067;border-color:#f0d800;}
      .niane-c9{background:#F5F5DC;border-color:#3E2723;} .niane-c10{background:#ff6a6a;border-color:#701100;}
      .niane-close-btn{align-self:flex-end;cursor:pointer;background:none;border:none;padding:0;line-height:0;}
      .niane-close-btn img{width:20px;display:block;}
      .niane-avatar{width:110px;height:110px;border-radius:50%;}
      hr.niane-hr{width:100%;margin:20px 0;border:0;border-top:1px solid var(--accent-soft,#B2E6F5);}

      /* ── Salvar tema + "bola" de temas salvos ── */
      .niane-save-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;}
      .niane-btn-save-theme{display:flex;align-items:center;gap:6px;border:none;border-radius:999px;
        padding:8px 16px;font-size:.82rem;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;
        background:linear-gradient(135deg,var(--accent,#5BC4E8),var(--accent2,#1f8ecd));transition:opacity .15s;}
      .niane-btn-save-theme:hover{opacity:.88;}
      .niane-btn-saved-themes{width:40px;height:40px;border-radius:50%;cursor:pointer;flex-shrink:0;
        border:2px solid var(--surface,#fff);box-shadow:0 0 0 1px var(--accent-soft,#B2E6F5);
        background:conic-gradient(from 0deg,#ff2d55,#ff9500,#ffe600,#00c853,#00b8d9,#7c3aed,#ff2d55);
        transition:transform .15s;padding:0;}
      .niane-btn-saved-themes:hover{transform:scale(1.12);}
      .niane-saved-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:14px;min-height:40px;}
      .niane-saved-empty{color:var(--text-muted,#6b8fa0);font-size:.85rem;text-align:center;margin-top:14px;}
      .niane-saved-swatch{position:relative;width:52px;height:52px;flex-shrink:0;}
      .niane-saved-swatch button.niane-swatch-apply{width:100%;height:100%;border-radius:50%;cursor:pointer;
        border:2px solid var(--surface,#fff);box-shadow:0 0 0 1px var(--accent-soft,#B2E6F5);transition:transform .15s;padding:0;}
      .niane-saved-swatch button.niane-swatch-apply:hover{transform:scale(1.1);}
      .niane-saved-swatch .niane-swatch-del{position:absolute;top:-6px;right:-6px;width:20px;height:20px;
        border-radius:50%;border:none;background:#c94b4b;color:#fff;font-size:12px;line-height:1;cursor:pointer;
        display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25);}
      .niane-back-btn{background:none;border:none;cursor:pointer;color:var(--accent2,#3AADD4);font-weight:700;
        font-size:.85rem;align-self:flex-start;padding:0;font-family:inherit;}
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="niane-overlay"></div>

      <div class="niane-modal" id="niane-popup-config">
        <button class="niane-close-btn" id="niane-close-config">
          <img src="../assets/images/fechar.png" alt="Fechar" onerror="this.parentElement.textContent='✕'">
        </button>
        <h2 class="niane-heading">Configurações</h2>
        <p class="niane-subheading" style="text-align:center;">Personalizar</p>
        <p class="niane-hint">Temas:</p>
        <div class="niane-color-options">
          <button class="niane-btn-color niane-c1" title="Rosa" onclick="mudarCor('#fce7f3','#db2777','#db2777')"></button>
          <button class="niane-btn-color niane-c2" title="Verde" onclick="mudarCor('#d1fae5','#059669','#059669')"></button>
          <button class="niane-btn-color niane-c3" title="Escuro" onclick="mudarCor('#2d3436','#ffffff','#5BC4E8')"></button>
          <button class="niane-btn-color niane-c4" title="Roxo" onclick="mudarCor('#8f60aa','#ffffff','#5e3d72')"></button>
          <button class="niane-btn-color niane-c5" title="Branco" onclick="mudarCor('#ffffff','#000000','#3AADD4')"></button>
          <button class="niane-btn-color niane-c6" title="Laranja" onclick="mudarCor('#f0a24a','#000000','#f08000')"></button>
          <button class="niane-btn-color niane-c8" title="Amarelo" onclick="mudarCor('#fff067','#000000','#b38f00')"></button>
          <button class="niane-btn-color niane-c9" title="Bege" onclick="mudarCor('#F5F5DC','#3E2723','#8a5a34')"></button>
          <button class="niane-btn-color niane-c10" title="Vermelho" onclick="mudarCor('#ff6a6a','#701100','#c62828')"></button>
        </div>
        <hr class="niane-hr">
        <p class="niane-hint">Criar seu tema:</p>
        <div class="niane-custom-theme-area">
          <div class="niane-input-group">
            <label>Fundo:</label><input type="color" id="niane-inputBg" value="#EAF6FB">
          </div>
          <div class="niane-input-group">
            <label>Texto:</label><input type="color" id="niane-inputTexto" value="#1a2b35">
          </div>
          <div class="niane-input-group">
            <label>Destaque:</label><input type="color" id="niane-inputAccent" value="#3AADD4">
          </div>
          <div class="niane-input-group">
            <label>Destaque 2:</label><input type="color" id="niane-inputAccent2" value="#3AADD4">
          </div>
        </div>
        <p class="niane-hint" style="font-size:11px;margin-top:10px;">
          "Destaque" pinta links, botões e a sidebar. "Destaque 2" pinta barras de progresso (Home, Pomodoro).
        </p>
        <div class="niane-save-row">
          <button type="button" class="niane-btn-save-theme" id="niane-btn-save-theme">💾 Salvar tema</button>
          <button type="button" class="niane-btn-saved-themes" id="niane-btn-saved-themes" title="Temas salvos" aria-label="Ver temas salvos"></button>
        </div>
        <p class="niane-subheading" style="text-align:center;">Tema clássico:</p>
        <div class="niane-color-classic">
          <button class="niane-btn-color niane-c7" title="Clássico" onclick="mudarCor('#EAF6FB','#1a2b35','#3AADD4')"></button>
        </div>
      </div>

      <div class="niane-modal" id="niane-popup-usuario">
        <button class="niane-close-btn" id="niane-close-usuario">
          <img src="../assets/images/fechar.png" alt="Fechar" onerror="this.parentElement.textContent='✕'">
        </button>
        <p>Usuário:</p><br>
        <center>
          <a href="login.html" style="color:var(--accent2,#3AADD4);">Login necessário</a>
          <br><br>
          <img class="niane-avatar" src="../assets/images/user.png" alt="Avatar do usuário">
          <p style="margin-top:14px;">Nome de usuário:</p>
          <p>E-mail:</p>
        </center>
      </div>

      <div class="niane-modal" id="niane-popup-saved-themes">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <button class="niane-back-btn" id="niane-back-saved-themes">← Voltar</button>
          <button class="niane-close-btn" id="niane-close-saved-themes">
            <img src="../assets/images/fechar.png" alt="Fechar" onerror="this.parentElement.textContent='✕'">
          </button>
        </div>
        <h2 class="niane-heading" style="font-size:1.5rem;">Temas salvos</h2>
        <p class="niane-hint">Clique num tema para aplicar, ou no ✕ para apagar.</p>
        <div class="niane-saved-grid" id="niane-saved-grid"></div>
      </div>
    `;
    document.body.appendChild(wrap);

    const overlay = document.getElementById('niane-overlay');
    const popupConfig = document.getElementById('niane-popup-config');
    const popupUsuario = document.getElementById('niane-popup-usuario');
    const popupSavedThemes = document.getElementById('niane-popup-saved-themes');

    function fecharTodos() {
      [popupConfig, popupUsuario, popupSavedThemes].forEach(p => p.classList.remove('niane-active'));
      overlay.classList.remove('niane-active');
    }
    function abrirPopup(popup) {
      fecharTodos();
      popup.classList.add('niane-active');
      overlay.classList.add('niane-active');
    }

    overlay.addEventListener('click', fecharTodos);
    document.getElementById('niane-close-config').addEventListener('click', fecharTodos);
    document.getElementById('niane-close-usuario').addEventListener('click', fecharTodos);
    document.getElementById('niane-close-saved-themes').addEventListener('click', fecharTodos);
    document.getElementById('niane-back-saved-themes').addEventListener('click', () => abrirPopup(popupConfig));

    const inputBg = document.getElementById('niane-inputBg');
    const inputTexto = document.getElementById('niane-inputTexto');
    const inputAccent = document.getElementById('niane-inputAccent');
    const inputAccent2 = document.getElementById('niane-inputAccent2');

    // Preenche os 4 seletores com o tema já aplicado na página (em vez dos
    // valores fixos do HTML), pra o popup nunca "desmentir" a cor que a
    // sidebar já está usando quando o usuário abre Configurações de novo.
    (function preencherComTemaAtual() {
      const cs = getComputedStyle(document.documentElement);
      const bgAtual = cs.getPropertyValue('--bg-site').trim() || cs.getPropertyValue('--bg').trim();
      const textoAtual = cs.getPropertyValue('--cor-primaria').trim() || cs.getPropertyValue('--text').trim();
      const accentAtual = cs.getPropertyValue('--accent2').trim();
      const accent2Atual = cs.getPropertyValue('--accent3').trim();
      if (bgAtual) inputBg.value = bgAtual;
      if (textoAtual) inputTexto.value = textoAtual;
      if (accentAtual) inputAccent.value = accentAtual;
      if (accent2Atual) inputAccent2.value = accent2Atual;
    })();

    function aplicarDosInputs() {
      mudarCor(inputBg.value, inputTexto.value, inputAccent.value, inputAccent2.value);
    }
    inputBg.addEventListener('input', aplicarDosInputs);
    inputTexto.addEventListener('input', aplicarDosInputs);
    inputAccent.addEventListener('input', aplicarDosInputs);
    inputAccent2.addEventListener('input', aplicarDosInputs);

    /* ---- Temas salvos pelo usuário ---- */
    const SAVED_THEMES_KEY = 'niane-saved-themes';
    function getSavedThemes() {
      try { return JSON.parse(localStorage.getItem(SAVED_THEMES_KEY)) || []; } catch (e) { return []; }
    }
    function setSavedThemes(lista) {
      try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(lista)); } catch (e) {}
    }

    const savedGrid = document.getElementById('niane-saved-grid');
    function renderSavedThemes() {
      const lista = getSavedThemes();
      savedGrid.innerHTML = '';
      if (!lista.length) {
        savedGrid.innerHTML = '<p class="niane-saved-empty">Nenhum tema salvo ainda. Crie um tema acima e clique em "Salvar tema".</p>';
        return;
      }
      lista.forEach((t, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'niane-saved-swatch';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'niane-swatch-apply';
        btn.title = `Tema ${i + 1}`;
        btn.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`;
        btn.addEventListener('click', () => {
          mudarCor(t.bg, t.text, t.accent, t.accent2);
          fecharTodos();
        });
        wrap.appendChild(btn);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'niane-swatch-del';
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

        savedGrid.appendChild(wrap);
      });
    }

    document.getElementById('niane-btn-save-theme').addEventListener('click', () => {
      const novo = { bg: inputBg.value, text: inputTexto.value, accent: inputAccent.value, accent2: inputAccent2.value };
      const lista = getSavedThemes();
      lista.push(novo);
      setSavedThemes(lista);
      const btn = document.getElementById('niane-btn-save-theme');
      const textoOriginal = btn.textContent;
      btn.textContent = '✓ Salvo!';
      setTimeout(() => { btn.textContent = textoOriginal; }, 1200);
    });

    document.getElementById('niane-btn-saved-themes').addEventListener('click', () => {
      renderSavedThemes();
      abrirPopup(popupSavedThemes);
    });

    // Conecta qualquer item de navegação marcado com id="nav-config" / "nav-usuario"
    // (ou atributo data-niane="config"/"usuario") em qualquer página.
    document.querySelectorAll('#nav-config, [data-niane="config"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); abrirPopup(popupConfig); });
    });
    document.querySelectorAll('#nav-usuario, [data-niane="usuario"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); abrirPopup(popupUsuario); });
    });

    window.NianeAbrirConfig = () => abrirPopup(popupConfig);
    window.NianeAbrirUsuario = () => abrirPopup(popupUsuario);
  }

  /* ------------------------------------------------------------------------
     3) MÚSICA — persistência entre páginas (MP3 local + Spotify)
     ------------------------------------------------------------------------ */
  const AUDIO_KEY = 'niane-audio-state';
  const DB_NAME = 'niane-db';
  const STORE_NAME = 'files';
  const BLOB_KEY = 'local-audio';

  function defaultAudioState() {
    return {
      source: null, // 'local' | 'spotify' | null
      local: { fileName: null, currentTime: 0, isPlaying: false },
      spotify: { uri: null, position: 0, duration: 0, isPlaying: false },
      volume: 1
    };
  }

  function getState() {
    try {
      const raw = JSON.parse(localStorage.getItem(AUDIO_KEY));
      if (raw && typeof raw === 'object') {
        return Object.assign(defaultAudioState(), raw, {
          local: Object.assign(defaultAudioState().local, raw.local || {}),
          spotify: Object.assign(defaultAudioState().spotify, raw.spotify || {})
        });
      }
    } catch (e) {}
    return defaultAudioState();
  }

  function setState(patch) {
    const s = Object.assign({}, getState(), patch);
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  // ---- IndexedDB (guarda os bytes do MP3 local para restaurar após navegação) ----
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB indisponível')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbSet(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbGet(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  const isMusicPage = () => !!document.getElementById('local-player');

  function getAudioEl() {
    let el = document.getElementById('local-player'); // já existe na musica.html
    if (el) return el;
    el = document.getElementById('niane-global-audio');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'niane-global-audio';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    return el;
  }

  let saveTimer = null;
  function throttledSaveLocalProgress(el) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setState({ local: Object.assign({}, getState().local, { currentTime: el.currentTime }) });
    }, 1500);
  }

  function bindLocalAudioEvents() {
    const el = getAudioEl();
    if (el.__nianeBound) return;
    el.__nianeBound = true;

    el.addEventListener('play', () => {
      setState({ source: 'local', local: Object.assign({}, getState().local, { isPlaying: true }) });
      updateMiniToggle();
    });
    el.addEventListener('pause', () => {
      setState({ local: Object.assign({}, getState().local, { isPlaying: false, currentTime: el.currentTime }) });
      updateMiniToggle();
    });
    el.addEventListener('timeupdate', () => throttledSaveLocalProgress(el));
    window.addEventListener('beforeunload', () => {
      if (!el.paused) {
        setState({ local: Object.assign({}, getState().local, { currentTime: el.currentTime, isPlaying: true }) });
      }
    });
  }

  // Chamado pela musica.html quando o usuário escolhe um arquivo MP3
  function saveLocalFile(file) {
    idbSet(BLOB_KEY, file).then(() => {
      setState({
        source: 'local',
        local: { fileName: file.name, currentTime: 0, isPlaying: true }
      });
      renderMiniBar();
    }).catch(() => {});
  }
  window.NianeSaveLocalFile = saveLocalFile; // hook opcional

  function restoreLocalAudio() {
    const s = getState();
    if (s.source !== 'local' || !s.local.fileName) return;
    idbGet(BLOB_KEY).then(blob => {
      if (!blob) return;
      const el = getAudioEl();
      const url = URL.createObjectURL(blob);
      el.src = url;
      const resume = () => {
        el.currentTime = s.local.currentTime || 0;
        if (s.local.isPlaying) {
          el.play().catch(() => { showMiniResumeState(); });
        }
        el.removeEventListener('loadedmetadata', resume);
      };
      el.addEventListener('loadedmetadata', resume);
      bindLocalAudioEvents();
      renderMiniBar();
    }).catch(() => {});
  }

  // ---- Spotify ----
  function ensureSpotifyApi(callback) {
    if (window.__nianeSpotifyIFrameAPI) { callback(window.__nianeSpotifyIFrameAPI); return; }
    window.__nianeSpotifyCallbacks = window.__nianeSpotifyCallbacks || [];
    window.__nianeSpotifyCallbacks.push(callback);
    const prevReady = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = function (IFrameAPI) {
      window.__nianeSpotifyIFrameAPI = IFrameAPI;
      window.__nianeSpotifyCallbacks.forEach(cb => cb(IFrameAPI));
      window.__nianeSpotifyCallbacks = [];
      if (typeof prevReady === 'function') prevReady(IFrameAPI);
    };
    if (!document.getElementById('niane-spotify-api') && !document.querySelector('script[src*="iframe-api"]')) {
      const s = document.createElement('script');
      s.id = 'niane-spotify-api';
      s.src = 'https://open.spotify.com/embed/iframe-api/v1';
      s.async = true;
      document.head.appendChild(s);
    }
  }

  // Chamado pela musica.html após criar o controller próprio, para sincronizar estado
  function bindSpotifyController(controller) {
    window.__nianeSpotifyController = controller;
    const s = getState();
    if (s.source === 'spotify' && s.spotify.uri) {
      setTimeout(() => {
        if (s.spotify.position) controller.seek(s.spotify.position);
        if (s.spotify.isPlaying) controller.resume();
      }, 600);
    }
    controller.addListener('playback_update', (e) => {
      setState({
        spotify: {
          uri: getState().spotify.uri,
          position: e.data.position,
          duration: e.data.duration,
          isPlaying: !e.data.isPaused
        }
      });
    });
  }
  window.NianeBindSpotifyController = bindSpotifyController;

  function setSpotifySource(uri) {
    setState({ source: 'spotify', spotify: { uri, position: 0, duration: 0, isPlaying: true } });
    renderMiniBar();
  }
  window.NianeSetSpotifySource = setSpotifySource;

  function restoreSpotifyMini() {
    const s = getState();
    if (s.source !== 'spotify' || !s.spotify.uri || isMusicPage()) return; // musica.html cuida do seu próprio player
    renderMiniBar();
  }

  // ---- Barras fixas no rodapé (música + pomodoro), empilhadas sem se
  //      sobrepor: cada uma vive dentro de um container comum. ----
  function ensureNianeBarStyles() {
    if (document.getElementById('niane-player-bar-styles')) return;
    const style = document.createElement('style');
    style.id = 'niane-player-bar-styles';
    style.textContent = `
      #niane-bottom-bars{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
        display:flex;flex-direction:column-reverse;align-items:center;gap:10px;
        z-index:900;max-width:92vw;pointer-events:none;}
      #niane-bottom-bars > *{pointer-events:auto;}
      .niane-bar{display:none;align-items:center;gap:12px;background:var(--surface,#fff);
        border:1.5px solid var(--accent-soft,#B2E6F5);border-radius:999px;
        box-shadow:0 10px 30px rgba(60,130,160,.18);padding:8px 10px 8px 18px;
        font-family:'DM Sans',sans-serif;color:var(--text,#1a2b35);
        opacity:0;transform:translateY(10px);transition:opacity .2s ease,transform .2s ease;
        max-width:92vw;}
      .niane-bar.niane-visible{display:flex;opacity:1;transform:translateY(0);}
      .niane-bar .niane-player-icon{font-size:1rem;flex-shrink:0;}
      .niane-bar .niane-player-label{font-size:.85rem;font-weight:600;
        max-width:38vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default;}
      .niane-bar .niane-player-label.niane-clickable{cursor:pointer;}
      .niane-bar .niane-player-label.niane-clickable:hover{text-decoration:underline;}
      .niane-bar .niane-player-toggle{width:34px;height:34px;border-radius:50%;border:none;
        background:var(--accent2,#3AADD4);color:#fff;cursor:pointer;font-size:.95rem;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .niane-bar .niane-player-toggle:hover{filter:brightness(1.08);}
      .niane-bar .niane-mini-spotify{width:300px;max-width:60vw;}
    `;
    document.head.appendChild(style);
  }

  function getBottomBarsContainer() {
    let wrap = document.getElementById('niane-bottom-bars');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'niane-bottom-bars';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function getMiniBar() {
    let bar = document.getElementById('niane-player-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'niane-player-bar';
      bar.className = 'niane-bar';
      getBottomBarsContainer().appendChild(bar);
    }
    return bar;
  }

  function updateMiniToggle() {
    const btn = document.getElementById('niane-player-toggle');
    if (!btn) return;
    const el = getAudioEl();
    btn.textContent = el.paused ? '▶' : '⏸';
  }

  function showMiniResumeState() {
    const btn = document.getElementById('niane-player-toggle');
    if (btn) btn.textContent = '▶';
  }

  function renderMiniBar() {
    if (isMusicPage()) return; // a própria página de música já mostra os players completos
    ensureNianeBarStyles();
    const s = getState();
    const bar = getMiniBar();

    if (!s.source) {
      bar.classList.remove('niane-visible');
      bar.innerHTML = '';
      return;
    }

    if (s.source === 'local' && s.local.fileName) {
      bar.innerHTML = `
        <span class="niane-player-icon">🎵</span>
        <span class="niane-player-label">${escapeHtml(s.local.fileName)}</span>
        <button class="niane-player-toggle" id="niane-player-toggle" aria-label="Tocar/Pausar">⏸</button>
      `;
      document.getElementById('niane-player-toggle').addEventListener('click', () => {
        const el = getAudioEl();
        if (el.paused) { el.play().catch(() => {}); } else { el.pause(); }
      });
      bar.classList.add('niane-visible');
      updateMiniToggle();
    } else if (s.source === 'spotify' && s.spotify.uri) {
      bar.innerHTML = `<span class="niane-player-icon">🎵</span><div class="niane-mini-spotify" id="niane-mini-spotify"></div>`;
      bar.classList.add('niane-visible');
      ensureSpotifyApi((IFrameAPI) => {
        const container = document.getElementById('niane-mini-spotify');
        if (!container) return;
        IFrameAPI.createController(container, { uri: s.spotify.uri, width: '100%', height: '80' }, (controller) => {
          bindSpotifyController(controller);
        });
      });
    } else {
      bar.classList.remove('niane-visible');
    }
  }

  /* ------------------------------------------------------------------------
     4) POMODORO — estado compartilhado entre todas as páginas.
     --------------------------------------------------------------------------
     Em vez de contar segundos com setInterval (que morre ao trocar de
     página), guardamos SEMPRE o horário em que a fase atual termina
     (endAt, timestamp absoluto). Assim, qualquer página — inclusive
     depois de navegar, ou mesmo depois de fechar e reabrir o app —
     recalcula "quanto falta" comparando com a hora atual, sem depender
     de nenhum timer ter "sobrevivido" no meio do caminho. Isso é o que
     permite o timer continuar rodando de verdade ao mudar de página,
     e a mini-barra (que vive dentro do mesmo container da música,
     empilhada, para nunca sobrepor o mini player de música) mostrar o
     tempo certo em qualquer lugar do app.
     ------------------------------------------------------------------------ */
  const POMODORO_KEY = 'niane-pomodoro-state';
  const POMODORO_TOTAL_KEY = 'niane-pomodoro-total-seconds';

  function defaultPomodoroState() {
    return {
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      totalCycles: 4,
      autoLoopEnabled: false,
      currentCycle: 1,
      currentPhase: 'focus',       // 'focus' | 'short' | 'long'
      phaseTotalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,   // válido quando running=false (foto do que restava ao pausar)
      accountedSeconds: 0,         // quanto da fase atual já foi somado nas estatísticas da Home
      running: false,
      endAt: null,                 // epoch ms em que a fase termina; válido quando running=true
      finishedLoopMessage: false
    };
  }

  function getPomodoroState() {
    try {
      const raw = JSON.parse(localStorage.getItem(POMODORO_KEY));
      if (raw && typeof raw === 'object') return Object.assign(defaultPomodoroState(), raw);
    } catch (e) {}
    return defaultPomodoroState();
  }

  function setPomodoroState(s) {
    try { localStorage.setItem(POMODORO_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  function getPomodoroTotalSeconds() {
    const raw = Number(localStorage.getItem(POMODORO_TOTAL_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function addPomodoroElapsedSeconds(seconds) {
    if (!(seconds > 0)) return;
    try { localStorage.setItem(POMODORO_TOTAL_KEY, String(getPomodoroTotalSeconds() + seconds)); } catch (e) {}
  }

  function pomodoroPhaseMinutes(s, phase) {
    if (phase === 'focus') return s.focusMinutes;
    if (phase === 'short') return s.breakMinutes;
    return s.longBreakMinutes;
  }

  function pomodoroRemaining(s) {
    if (!s.running || !s.endAt) return Math.max(0, Math.round(s.remainingSeconds));
    return Math.max(0, Math.round((s.endAt - Date.now()) / 1000));
  }

  // Soma nas estatísticas (usadas na Home) só o pedaço da fase atual que
  // ainda não tinha sido contado — funciona tanto segundo a segundo
  // quanto "de uma vez só" se ninguém abriu o app por um tempo.
  function pomodoroAccount(s) {
    if (!s.running) return s;
    const remaining = pomodoroRemaining(s);
    const elapsedInPhase = Math.max(0, Math.min(s.phaseTotalSeconds, s.phaseTotalSeconds - remaining));
    const delta = elapsedInPhase - (s.accountedSeconds || 0);
    if (delta > 0) {
      addPomodoroElapsedSeconds(delta);
      s.accountedSeconds = elapsedInPhase;
    }
    return s;
  }

  function pomodoroSetPhase(s, phase, autoStart) {
    s.currentPhase = phase;
    s.phaseTotalSeconds = pomodoroPhaseMinutes(s, phase) * 60;
    s.remainingSeconds = s.phaseTotalSeconds;
    s.accountedSeconds = 0;
    s.running = false;
    s.endAt = null;
    s.finishedLoopMessage = false;
    if (autoStart) {
      s.running = true;
      s.endAt = Date.now() + s.phaseTotalSeconds * 1000;
    }
    return s;
  }

  // Avança de fase quando o tempo acaba (só usado com o loop automático
  // ligado — sem loop, o timer simplesmente para e espera o usuário).
  function pomodoroAdvance(s) {
    if (s.currentPhase === 'focus') return pomodoroSetPhase(s, 'short', true);
    if (s.currentPhase === 'short') {
      if (s.currentCycle < s.totalCycles) {
        s.currentCycle += 1;
        return pomodoroSetPhase(s, 'focus', true);
      }
      return pomodoroSetPhase(s, 'long', true);
    }
    // 'long' -> loop completo, volta pro início e avisa
    s.currentCycle = 1;
    s = pomodoroSetPhase(s, 'focus', false);
    s.finishedLoopMessage = true;
    return s;
  }

  // Processa fases que já deveriam ter terminado (ex.: deixou rodando,
  // fechou o app/aba, e só voltou bem depois).
  function pomodoroCatchUp(s) {
    let guard = 0;
    while (s.running && pomodoroRemaining(s) <= 0 && guard < 1000) {
      guard += 1;
      s = pomodoroAccount(s); // credita o que sobrou da fase que terminou
      if (s.autoLoopEnabled) {
        s = pomodoroAdvance(s);
      } else {
        s.running = false;
        s.endAt = null;
        s.remainingSeconds = 0;
        break;
      }
    }
    return s;
  }

  const pomodoroListeners = [];
  function pomodoroOnUpdate(fn) { pomodoroListeners.push(fn); }
  function pomodoroRenderAll(s) {
    renderPomodoroMiniBar(s);
    pomodoroListeners.forEach((fn) => { try { fn(s); } catch (e) {} });
  }

  function pomodoroTick() {
    let s = getPomodoroState();
    if (!s.running) return;
    s = pomodoroAccount(s);
    if (pomodoroRemaining(s) <= 0) s = pomodoroCatchUp(s);
    setPomodoroState(s);
    pomodoroRenderAll(s);
  }

  function pomodoroStart() {
    let s = getPomodoroState();
    if (s.running) return s;
    if (s.remainingSeconds <= 0) s.remainingSeconds = s.phaseTotalSeconds;
    s.running = true;
    s.endAt = Date.now() + s.remainingSeconds * 1000;
    s.finishedLoopMessage = false;
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  function pomodoroPause() {
    let s = getPomodoroState();
    if (!s.running) return s;
    s = pomodoroAccount(s);
    s.remainingSeconds = pomodoroRemaining(s);
    s.running = false;
    s.endAt = null;
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  function pomodoroReset() {
    let s = getPomodoroState();
    if (s.autoLoopEnabled) { s.currentCycle = 1; s.currentPhase = 'focus'; }
    s = pomodoroSetPhase(s, s.currentPhase, false);
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  // Clique manual num modo (Foco/Pausa curta/Pausa longa): sai do loop
  // automático, igual ao comportamento original.
  function pomodoroSetActiveModeManual(phase) {
    let s = getPomodoroState();
    s.autoLoopEnabled = false;
    s.currentCycle = 1;
    s = pomodoroSetPhase(s, phase, false);
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  function pomodoroSetAutoLoop(enabled) {
    let s = getPomodoroState();
    s.autoLoopEnabled = !!enabled;
    if (s.autoLoopEnabled) {
      s.currentCycle = 1;
      s = pomodoroSetPhase(s, 'focus', false);
    }
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  // Salva as alterações de tempos/ciclos (isso é o que fica gravado no
  // localStorage e volta preenchido mesmo depois de fechar o app).
  function pomodoroApplyCustomTimes(vals) {
    let s = getPomodoroState();
    if (vals && vals.focusMinutes) s.focusMinutes = vals.focusMinutes;
    if (vals && vals.breakMinutes) s.breakMinutes = vals.breakMinutes;
    if (vals && vals.longBreakMinutes) s.longBreakMinutes = vals.longBreakMinutes;
    if (vals && vals.totalCycles) s.totalCycles = vals.totalCycles;
    if (!s.running) s = pomodoroSetPhase(s, s.currentPhase, false);
    setPomodoroState(s);
    pomodoroRenderAll(s);
    return s;
  }

  function pomodoroFormatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function pomodoroPhaseLabel(phase) {
    if (phase === 'focus') return 'Foco';
    if (phase === 'short') return 'Pausa curta';
    return 'Pausa longa';
  }

  const isPomodoroPage = () => !!document.getElementById('timer-display');

  function getPomodoroBar() {
    let bar = document.getElementById('niane-pomodoro-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'niane-pomodoro-bar';
      bar.className = 'niane-bar';
      getBottomBarsContainer().appendChild(bar);
    }
    return bar;
  }

  // Mostra o mini pop do Pomodoro em QUALQUER página (menos na própria
  // pomodoro.html, que já mostra o timer inteiro). Fica empilhado junto
  // com o mini player de música, sem se sobrepor a ele, mesmo que os
  // dois estejam ativos ao mesmo tempo.
  function renderPomodoroMiniBar(s) {
    if (isPomodoroPage()) return;
    ensureNianeBarStyles();
    s = s || getPomodoroState();
    const bar = getPomodoroBar();
    const remaining = pomodoroRemaining(s);
    const temSessaoAtiva = s.running || (s.remainingSeconds > 0 && s.remainingSeconds < s.phaseTotalSeconds);

    if (!temSessaoAtiva) {
      bar.classList.remove('niane-visible');
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = `
      <span class="niane-player-icon">⏱</span>
      <span class="niane-player-label niane-clickable" id="niane-pomodoro-label">${escapeHtml(pomodoroPhaseLabel(s.currentPhase))} · ${pomodoroFormatTime(remaining)}</span>
      <button class="niane-player-toggle" id="niane-pomodoro-toggle" aria-label="Iniciar/Pausar Pomodoro">${s.running ? '⏸' : '▶'}</button>
    `;
    document.getElementById('niane-pomodoro-toggle').addEventListener('click', () => {
      const cur = getPomodoroState();
      if (cur.running) pomodoroPause(); else pomodoroStart();
    });
    document.getElementById('niane-pomodoro-label').addEventListener('click', () => {
      window.location.href = 'pomodoro.html';
    });
    bar.classList.add('niane-visible');
  }

  function initPomodoro() {
    let s = getPomodoroState();
    s = pomodoroAccount(s);
    if (s.running && pomodoroRemaining(s) <= 0) s = pomodoroCatchUp(s);
    setPomodoroState(s);
    pomodoroRenderAll(s);
    setInterval(pomodoroTick, 1000);
  }

  window.NianePomodoro = {
    getState: getPomodoroState,
    getRemainingSeconds: (s) => pomodoroRemaining(s || getPomodoroState()),
    start: pomodoroStart,
    pause: pomodoroPause,
    reset: pomodoroReset,
    setActiveModeManual: pomodoroSetActiveModeManual,
    setAutoLoop: pomodoroSetAutoLoop,
    applyCustomTimes: pomodoroApplyCustomTimes,
    onUpdate: pomodoroOnUpdate,
    phaseLabel: pomodoroPhaseLabel,
    formatTime: pomodoroFormatTime
  };

  /* ------------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------------ */
  onReady(() => {
    ensureFonts();
    ensureConstantTokens();
    loadTheme();
    injectPopups();

    if (isMusicPage()) {
      // A própria musica.html vai chamar NianeSaveLocalFile / NianeBindSpotifyController.
      bindLocalAudioEvents();
      restoreLocalAudio();
    } else {
      restoreLocalAudio();   // cria player oculto e retoma o MP3, se houver
      restoreSpotifyMini();  // mostra mini player do Spotify, se houver
    }

    initPomodoro();
  });

  // Expõe utilidades para as páginas que precisarem interagir diretamente
  window.NianeAudio = {
    getState, setState, saveLocalFile, setSpotifySource,
    bindSpotifyController, getAudioEl, renderMiniBar
  };
})();
