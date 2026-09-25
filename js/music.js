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

  // Ruído "rosa" (pink noise): energia distribuída de forma mais
  // equilibrada entre graves e agudos do que o ruído marrom — é o
  // tipo de ruído normalmente usado em apps de foco/white noise,
  // porque fica claramente audível em qualquer alto-falante.
  // Algoritmo de Paul Kellet (aproximação padrão de pink noise).
  function createPinkNoiseBuffer(ctx, seconds) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; // normaliza pra ficar na faixa -1..1
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

  // Foco: ruído contínuo e estável (ruído rosa levemente filtrado),
  // sem variações, para mascarar distrações. Mantém corte suave nos
  // agudos pra soar "estável" em vez de "chiado", mas com energia
  // suficiente em médios/graves para ser audível em qualquer caixa.
  function buildFoco(ctx) {
    const source = makeNoiseSource(ctx, createPinkNoiseBuffer(ctx, 4));

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2200;

    const gain = ctx.createGain();
    gain.gain.value = 0.4;

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
