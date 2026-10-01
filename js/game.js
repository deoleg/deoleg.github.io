(() => {
  'use strict';

  const WORDS_PER_ROUND = 4;
  const USED_RESET_THRESHOLD = 8;

  const state = {
    minutes: 1,
    seconds: 0,
    running: false,
    interval: null,
    usedWords: new Set(),
    currentWords: [],
    currentLetter: '',
    roundStarted: false
  };

  const $ = (id) => document.getElementById(id);

  const minuteValue = $('minutes');
  const secondValue = $('seconds');
  const letterEl = $('letter');
  const wordsEl = $('words');
  const startBtn = $('startBtn');
  const resetBtn = $('resetBtn');
  const newRoundBtn = $('newRoundBtn');
  const timerEl = $('timer');
  const statusEl = $('status');
  const minuteUp = $('minuteUp');
  const minuteDown = $('minuteDown');
  const secondUp = $('secondUp');
  const secondDown = $('secondDown');

  function format(value) {
    return String(value).padStart(2, '0');
  }

  function renderTime() {
    minuteValue.textContent = format(state.minutes);
    secondValue.textContent = format(state.seconds);
  }

  function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  function setControlsDisabled(disabled) {
    [minuteUp, minuteDown, secondUp, secondDown].forEach(btn => {
      btn.disabled = disabled;
    });
  }

  function changeMinutes(delta) {
    if (state.running) return;
    state.minutes = Math.max(0, Math.min(59, state.minutes + delta));
    renderTime();
  }

  function changeSeconds(delta) {
    if (state.running) return;
    let total = state.minutes * 60 + state.seconds + delta;
    total = Math.max(0, Math.min(59 * 60 + 55, total));
    state.minutes = Math.floor(total / 60);
    state.seconds = total % 60;
    state.seconds = Math.floor(state.seconds / 5) * 5;
    renderTime();
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateRound() {
    if (GAME_WORDS.length < WORDS_PER_ROUND) return;

    // When the pool is nearly exhausted, allow previously used words again.
    if (GAME_WORDS.length - state.usedWords.size < WORDS_PER_ROUND + USED_RESET_THRESHOLD) {
      state.usedWords.clear();
    }

    const available = GAME_WORDS.filter(word => !state.usedWords.has(word));
    const selected = [];

    while (selected.length < WORDS_PER_ROUND && available.length) {
      const index = Math.floor(Math.random() * available.length);
      selected.push(available.splice(index, 1)[0]);
    }

    selected.forEach(word => state.usedWords.add(word));

    state.currentWords = selected;
    state.currentLetter = randomItem(GAME_LETTERS);

    letterEl.textContent = state.currentLetter;
    wordsEl.innerHTML = selected.map(word => `<li>${word}</li>`).join('');
    state.roundStarted = false;

    setStatus('Готово к новому раунду');
  }

  function resetTimerOnly() {
    stopTimer();
    state.minutes = Math.max(0, state.minutes);
    state.seconds = Math.floor(Math.max(0, state.seconds) / 5) * 5;
    renderTime();
    setControlsDisabled(false);
    timerEl.classList.remove('finished');
  }

  function stopTimer() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.running = false;
    startBtn.disabled = false;
    newRoundBtn.disabled = false;
    setControlsDisabled(false);
  }

  function startTimer() {
    if (state.running) return;

    if (state.minutes === 0 && state.seconds === 0) {
      setStatus('Установите время больше нуля', 'error');
      return;
    }

    state.running = true;
    state.roundStarted = true;
    startBtn.disabled = true;
    newRoundBtn.disabled = true;
    setControlsDisabled(true);
    timerEl.classList.remove('finished');
    setStatus('Игра идёт');

    state.interval = setInterval(() => {
      if (state.seconds > 0) {
        state.seconds -= 1;
      } else if (state.minutes > 0) {
        state.minutes -= 1;
        state.seconds = 59;
      } else {
        finishRound();
        return;
      }

      renderTime();
    }, 1000);
  }

  function finishRound() {
    stopTimer();
    timerEl.classList.add('finished');
    setStatus('Время вышло', 'finished');
  }

  function resetGame() {
    stopTimer();
    timerEl.classList.remove('finished');
    generateRound();
    renderTime();
    setStatus('Готово к новому раунду');
  }

  function nextRound() {
    if (state.running) return;
    timerEl.classList.remove('finished');
    state.minutes = state.initialMinutes ?? state.minutes;
    state.seconds = state.initialSeconds ?? state.seconds;
    generateRound();
    renderTime();
  }

  // Store the selected duration whenever it is changed.
  function rememberDuration() {
    if (!state.running) {
      state.initialMinutes = state.minutes;
      state.initialSeconds = state.seconds;
    }
  }

  minuteUp.addEventListener('click', () => {
    changeMinutes(1);
    rememberDuration();
  });

  minuteDown.addEventListener('click', () => {
    changeMinutes(-1);
    rememberDuration();
  });

  secondUp.addEventListener('click', () => {
    changeSeconds(5);
    rememberDuration();
  });

  secondDown.addEventListener('click', () => {
    changeSeconds(-5);
    rememberDuration();
  });

  startBtn.addEventListener('click', startTimer);

  resetBtn.addEventListener('click', () => {
    stopTimer();
    state.minutes = state.initialMinutes ?? 1;
    state.seconds = state.initialSeconds ?? 0;
    renderTime();
    timerEl.classList.remove('finished');
    setStatus('Таймер сброшен');
  });

  newRoundBtn.addEventListener('click', nextRound);

  state.initialMinutes = state.minutes;
  state.initialSeconds = state.seconds;
  renderTime();
  generateRound();
})();
