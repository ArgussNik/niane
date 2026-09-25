(function () {
  'use strict';

  let embedController;

  // ---------------------------------------------------------------
  // SONS AMBIENTES
  // Gerados via Web Audio API (sem depender de arquivos de áudio
  // externos). Apenas um som ambiente toca por vez: iniciar um novo
  // para automaticamente o anterior.
  // ---------------------------------------------------------------

  let ambientCtx = null;
  let currentAmbient = null; // { type, stop }

  function getAmbientContext() {
    if (!ambientCtx) {
      ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ambientCtx.state === 'suspended') {
      ambientCtx.resume();
    }
    return ambientCtx;
  }

  // Cria um buffer de ruído branco em loop (alguns segundos bastam,
  // já que o loop é contínuo e o ouvido não percebe a repetição).
  function createWhiteNoiseBuffer(ctx, seconds) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Ruído "marrom" (mais grave e encorpado que o branco), obtido
  // integrando o ruído branco amostra a amostra.
  function createBrownNoiseBuffer(ctx, seconds) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5; // compensa a perda de amplitude da integração
    }
    return buffer;
  }

  function makeNoiseSource(ctx, buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  // Calmaria: ruído filtrado lembrando chuva, com leve variação
  // no filtro para dar sensação de "respingos".
  function buildCalmaria(ctx) {
    const source = makeNoiseSource(ctx, createWhiteNoiseBuffer(ctx, 4));

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 600;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;

    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 900;
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    return {
      start() { source.start(); lfo.start(); },
      stop() { source.stop(); lfo.stop(); }
    };
  }

  // Natureza: ruído filtrado com "rajadas" lentas de vento
  // (o filtro passa-banda se move devagar, como vento entre folhas).
  function buildNatureza(ctx) {
    const source = makeNoiseSource(ctx, createWhiteNoiseBuffer(ctx, 4));

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 500;
    bandpass.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.2;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06; // rajadas bem lentas
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);

    return {
      start() { source.start(); lfo.start(); },
      stop() { source.stop(); lfo.stop(); }
    };
  }

  // Foco: ruído grave e contínuo (ruído marrom filtrado),
  // sem variações, para mascarar distrações.
  function buildFoco(ctx) {
    const source = makeNoiseSource(ctx, createBrownNoiseBuffer(ctx, 4));

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 250;

    const gain = ctx.createGain();
    gain.gain.value = 0.35;

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    return {
      start() { source.start(); },
      stop() { source.stop(); }
    };
  }

  const AMBIENT_BUILDERS = {
    calmaria: buildCalmaria,
    natureza: buildNatureza,
    foco: buildFoco
  };

  function stopCurrentAmbient() {
    if (currentAmbient) {
      try { currentAmbient.stop(); } catch (e) { /* já parado */ }
      currentAmbient = null;
    }
    document.querySelectorAll('.ambient-btn').forEach((btn) => {
      btn.classList.remove('active');
      const statusEl = btn.querySelector('.ambient-status');
      if (statusEl && btn.dataset.defaultStatus) {
        statusEl.textContent = btn.dataset.defaultStatus;
      }
    });
  }

  function initAmbientSounds() {
    const buttons = document.querySelectorAll('.ambient-btn');

    buttons.forEach((btn) => {
      const statusEl = btn.querySelector('.ambient-status');
      if (statusEl) {
        btn.dataset.defaultStatus = statusEl.textContent;
      }

      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const builder = AMBIENT_BUILDERS[type];
        if (!builder) return;

        // Clicou no que já está tocando: apenas pausa.
        if (currentAmbient && currentAmbient.type === type) {
          stopCurrentAmbient();
          return;
        }

        // Garante que só um ambiente toca por vez.
        stopCurrentAmbient();

        const ctx = getAmbientContext();
        const instance = builder(ctx);
        instance.start();
        currentAmbient = { type, stop: instance.stop };

        btn.classList.add('active');
        if (statusEl) statusEl.textContent = 'Tocando...';
      });
    });
  }

  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    const element = document.getElementById('embed-iframe');
    const savedState = window.NianeAudio ? NianeAudio.getState() : null;
    const savedUri = savedState && savedState.source === 'spotify' ? savedState.spotify.uri : null;
    const options = {
      uri: savedUri || 'spotify:playlist:37i9dQZF1DWWQRwui0ExPn',
      width: '100%',
      height: '352'
    };
    IFrameAPI.createController(element, options, (controller) => {
      embedController = controller;
      console.log('API do Spotify Pronta.');
      if (window.NianeAudio) NianeAudio.bindSpotifyController(controller);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initAmbientSounds();

    const loadBtn = document.getElementById('load-btn');
    const urlInput = document.getElementById('playlist-url');

    loadBtn.addEventListener('click', () => {
      const fullText = urlInput.value.trim();
      if (!fullText) return;

      console.log('Texto colado:', fullText);

      const pattern = /(album|playlist|track|artist)[\/:][a-zA-Z0-9]+/g;
      const found = fullText.match(pattern);

      if (found && embedController) {
        const cleanUri = 'spotify:' + found[0].replace('/', ':');
        console.log('URI Gerada:', cleanUri);
        embedController.loadUri(cleanUri);
        if (window.NianeAudio) NianeAudio.setSpotifySource(cleanUri);
        urlInput.value = '';
      } else {
        alert('Link não reconhecido. Certifique-se de que o link contém \'album/\', \'playlist/\' ou \'track/\'');
      }
    });

    const mp3Input = document.getElementById('mp3-input');
    const localPlayer = document.getElementById('local-player');

    mp3Input.addEventListener('change', function () {
      const file = this.files[0];
      if (file) {
        const fileURL = URL.createObjectURL(file);
        localPlayer.src = fileURL;
        localPlayer.play();
        if (window.NianeAudio) NianeAudio.saveLocalFile(file);
      }
    });
  });
})();
