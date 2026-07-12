(function () {
  'use strict';

  let embedController;

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
