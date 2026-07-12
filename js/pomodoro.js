(function () {
  'use strict';

document.addEventListener('DOMContentLoaded', function () {
    const P = window.NianePomodoro;
    if (!P) return; // segurança: se por algum motivo niane-shared.js não carregou

    const modeButtons = document.querySelectorAll('.mode');
    const display = document.getElementById('timer-display');
    const startButton = document.getElementById('start');
    const pauseButton = document.getElementById('pause');
    const resetButton = document.getElementById('reset');
    const focusInput = document.getElementById('focus-time');
    const breakInput = document.getElementById('break-time');
    const longBreakInput = document.getElementById('long-break-time');
    const applyButton = document.getElementById('apply-times');
    const progressCircle = document.getElementById('progress-circle');
    const cyclesInput = document.getElementById('cycles-count');
    const autoLoopToggle = document.getElementById('auto-loop-toggle');
    const loopStatus = document.getElementById('loop-status');

    const circumference = 2 * Math.PI * 140;

    function buttonForPhase(phase) {
      return document.querySelector(`.mode[data-phase="${phase}"]`);
    }

    /* Preenche os campos de configuração com o que está salvo, sem
       atropelar o que a pessoa estiver digitando no momento. */
    function syncInputsFromState(s) {
      if (document.activeElement !== focusInput) focusInput.value = s.focusMinutes;
      if (document.activeElement !== breakInput) breakInput.value = s.breakMinutes;
      if (document.activeElement !== longBreakInput) longBreakInput.value = s.longBreakMinutes;
      if (document.activeElement !== cyclesInput) cyclesInput.value = s.totalCycles;
      autoLoopToggle.checked = s.autoLoopEnabled;

      buttonForPhase('focus').dataset.minutes = s.focusMinutes;
      buttonForPhase('focus').textContent = `Foco (${s.focusMinutes} min)`;
      buttonForPhase('short').dataset.minutes = s.breakMinutes;
      buttonForPhase('short').textContent = `Pausa curta (${s.breakMinutes} min)`;
      buttonForPhase('long').dataset.minutes = s.longBreakMinutes;
      buttonForPhase('long').textContent = `Pausa longa (${s.longBreakMinutes} min)`;
    }

    /* Único ponto que desenha a tela inteira, sempre a partir do estado
       compartilhado (nunca de variáveis locais) — assim a tela sempre
       mostra o tempo certo, mesmo depois de voltar de outra página. */
    function render(s) {
      s = s || P.getState();
      const remaining = P.getRemainingSeconds(s);

      display.textContent = P.formatTime(remaining);
      const progress = s.phaseTotalSeconds > 0 ? remaining / s.phaseTotalSeconds : 0;
      progressCircle.style.strokeDashoffset = (1 - progress) * circumference;

      modeButtons.forEach((btn) => {
        const isActive = btn.dataset.phase === s.currentPhase;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      if (s.autoLoopEnabled) {
        loopStatus.textContent = `Ciclo ${s.currentCycle} de ${s.totalCycles} · ${P.phaseLabel(s.currentPhase)}`;
      } else if (s.finishedLoopMessage) {
        loopStatus.textContent = `🎉 Loop concluído! ${s.totalCycles} ciclos completos.`;
      } else {
        loopStatus.textContent = '';
      }

      startButton.disabled = s.running;
      pauseButton.disabled = !s.running;

      syncInputsFromState(s);
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => P.setActiveModeManual(button.dataset.phase));
    });

    applyButton.addEventListener('click', () => {
      P.applyCustomTimes({
        focusMinutes: Number(focusInput.value) || undefined,
        breakMinutes: Number(breakInput.value) || undefined,
        longBreakMinutes: Number(longBreakInput.value) || undefined,
        totalCycles: Number(cyclesInput.value) || undefined
      });
    });

    autoLoopToggle.addEventListener('change', () => {
      P.setAutoLoop(autoLoopToggle.checked);
    });

    startButton.addEventListener('click', () => P.start());
    pauseButton.addEventListener('click', () => P.pause());
    resetButton.addEventListener('click', () => P.reset());

    /* Todo update de estado (venha de qualquer botão desta página, ou
       até de outra aba/janela) passa por aqui e redesenha a tela. */
    P.onUpdate(render);
    render(P.getState());
  });
})();
