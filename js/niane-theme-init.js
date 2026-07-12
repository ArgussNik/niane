/* ==========================================================================
   NIANE — niane-theme-init.js
   --------------------------------------------------------------------------
   Este script deve ser incluído no <head> de TODAS as páginas, LOGO NO
   INÍCIO (antes de qualquer <link rel="stylesheet">), SEM "defer"/"async".

   Por quê: antes, o tema só era reaplicado pelo niane-shared.js, que roda
   com "defer" no fim do <body> — ou seja, depois que o CSS de cada página
   (listas.css, pomodoro.css, notes.css, o <style> de home.html etc.) já
   definiu suas próprias variáveis padrão em :root. Isso fazia o tema
   "sumir" ao navegar: a página abria com a paleta padrão daquele arquivo
   CSS e só trocava de cor (inclusive a sidebar) um instante depois — e em
   alguns casos nem chegava a trocar antes do usuário perceber, dando a
   impressão de que a customização só "colava" na Home.

   Este arquivo resolve isso aplicando a paleta salva (localStorage)
   IMEDIATAMENTE, antes do navegador sequer carregar o CSS da página, então
   toda página — e toda sidebar — já nasce com a cor certa, sem flash e sem
   depender de nada mais carregar antes.

   A lógica de derivação de paleta (bg/text/accent -> paleta completa) mora
   só aqui; niane-shared.js reaproveita via `window.NianeTheme` para os dois
   nunca ficarem dessincronizados.
   ========================================================================== */
(function () {
  'use strict';

  var THEME_KEY = 'niane-theme';
  var DEFAULT_ACCENT = '#3AADD4';

  var DEFAULT_PALETTE = {
    bg: '#EAF6FB', text: '#1a2b35',
    surface: '#ffffff', surface2: '#D8F0FA',
    accent: '#5BC4E8', accent2: '#3AADD4', accentSoft: '#B2E6F5',
    accent3: '#3AADD4', accent3Soft: '#B2E6F5',
    textMuted: '#6b8fa0'
  };

  /* ---- utilidades de cor (hex <-> rgb, mistura, brilho percebido) ---- */
  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }
  function hexToRgb(hex) {
    hex = String(hex).trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 255, g: 255, b: 255 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function rgbToHex(rgb) {
    return '#' + ['r', 'g', 'b'].map(function (k) {
      return clamp255(rgb[k]).toString(16).padStart(2, '0');
    }).join('');
  }
  function mix(hexA, hexB, weight) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex({
      r: a.r + (b.r - a.r) * weight,
      g: a.g + (b.g - a.g) * weight,
      b: a.b + (b.b - a.b) * weight
    });
  }
  function perceivedBrightness(hex) {
    var c = hexToRgb(hex);
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000; // 0 (escuro) – 255 (claro)
  }

  /* Deriva a paleta completa (usada em TODAS as páginas/sidebars) a partir
     de fundo + texto + cor de destaque. Mantido idêntico ao que já existia
     em niane-shared.js — os temas pré-definidos não mudam. */
  function derivePalette(bg, text, accentBase, accentBase2) {
    accentBase = accentBase || DEFAULT_ACCENT;
    // Destaque 2 (cor secundária, ex.: barras de progresso). Se não for
    // informada, acompanha o destaque principal — então temas de um clique
    // (presets) continuam com uma única cor de destaque, como antes.
    accentBase2 = accentBase2 || accentBase;
    var isDark = perceivedBrightness(bg) < 128;
    var surface = isDark ? mix(bg, '#ffffff', 0.12) : '#ffffff';
    var surface2 = isDark ? mix(bg, '#ffffff', 0.20) : mix(bg, '#ffffff', 0.45);
    var accentSoft = isDark ? mix(bg, accentBase, 0.38) : mix('#ffffff', accentBase, 0.30);
    var accent3Soft = isDark ? mix(bg, accentBase2, 0.38) : mix('#ffffff', accentBase2, 0.30);
    var accent2 = accentBase;
    var accent = mix(accentBase, '#ffffff', 0.30);
    var accent3 = accentBase2;
    var textMuted = mix(text, bg, 0.42);
    return {
      bg: bg, text: text, surface: surface, surface2: surface2,
      accent: accent, accent2: accent2, accentSoft: accentSoft,
      accent3: accent3, accent3Soft: accent3Soft, textMuted: textMuted
    };
  }

  /* Aplica a paleta inteira no elemento <html> (documentElement). Como é um
     estilo inline, ele sempre vence qualquer `:root{...}` definido nos .css
     de cada página — mas agora rodamos isso ANTES desses .css carregarem,
     então nem existe uma cor "errada" para o usuário ver primeiro. */
  function applyPalette(p) {
    var root = document.documentElement.style;
    root.setProperty('--bg', p.bg);
    root.setProperty('--bg-site', p.bg);        // compat: Configs-Usuario.html
    root.setProperty('--text', p.text);
    root.setProperty('--cor-primaria', p.text); // compat: Configs-Usuario.html
    root.setProperty('--surface', p.surface);
    root.setProperty('--surface2', p.surface2);
    root.setProperty('--accent', p.accent);
    root.setProperty('--accent2', p.accent2);
    root.setProperty('--accent-soft', p.accentSoft);
    // Destaque 2 (cor secundária): usa fallback para o destaque principal
    // caso a paleta tenha sido salva antes desta cor existir.
    root.setProperty('--accent3', p.accent3 || p.accent2);
    root.setProperty('--accent3-soft', p.accent3Soft || p.accentSoft);
    root.setProperty('--text-muted', p.textMuted);
    // aliases usados em listas.html/notes.html (mesmo sistema de cores)
    root.setProperty('--text-primary', p.text);
    root.setProperty('--text-secondary', p.textMuted);
    root.setProperty('--card-bg', p.surface);
    root.setProperty('--border', p.accentSoft);
    root.setProperty('--accent-bg', p.accentSoft);
    root.setProperty('--accent-text', p.accent2);
  }

  function loadSavedPalette() {
    try {
      var saved = JSON.parse(localStorage.getItem(THEME_KEY));
      if (saved && saved.bg && saved.text) {
        // paletas antigas (só {bg,text}) ainda funcionam: completamos o resto
        return saved.surface ? saved : derivePalette(saved.bg, saved.text, saved.accent2, saved.accent3);
      }
    } catch (e) { /* localStorage indisponível (ex.: file:// em alguns navegadores) */ }
    return null;
  }

  /* Deriva + aplica + salva de uma vez (usado pelos botões de cor). */
  function applyTheme(bg, text, accentBase, accentBase2) {
    var palette = derivePalette(bg, text, accentBase, accentBase2);
    applyPalette(palette);
    try { localStorage.setItem(THEME_KEY, JSON.stringify(palette)); } catch (e) {}
    return palette;
  }

  /* ---- roda imediatamente, antes do <link rel="stylesheet"> seguinte ---- */
  applyPalette(DEFAULT_PALETTE);
  var saved = loadSavedPalette();
  if (saved) applyPalette(saved);

  /* Exposto para niane-shared.js (popups) e para Configs-Usuario.html
     reaproveitarem exatamente a mesma lógica, em vez de reimplementar. */
  window.NianeTheme = {
    THEME_KEY: THEME_KEY,
    DEFAULT_PALETTE: DEFAULT_PALETTE,
    derivePalette: derivePalette,
    applyPalette: applyPalette,
    loadSavedPalette: loadSavedPalette,
    applyTheme: applyTheme
  };
})();
