(() => {
  const root = document.getElementById('app');
  if (!root) return;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const pct = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;

  const state = {
    soundEnabled: true,
    gameState: 'setup',
    gameDuration: 300,
    timeLeft: 300,
    digitCount: 3,
    nextLevel: 3,
    sequence: [],
    userInput: '',
    displayIndex: -1,
    showNumber: false,
    countdownVal: 3,
    lastResult: {
      correctAnswer: '',
      userAnswer: '',
      isPerfect: false,
      accuracy: 0,
      msg: '',
      type: 'stay'
    },
    scoreStats: {
      totalAttempts: 0,
      perfectClears: 0,
      maxLevel: 3,
      startLevel: 3,
      accuracySum: 0,
      currentStreak: 0,
      bestStreakThisRun: 0
    }
  };

  const audioState = { ctx: null };

  const playTone = (type = 'sine') => {
    if (!state.soundEnabled) return;
    if (!audioState.ctx) {
      audioState.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioState.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    switch (type) {
      case 'tick':
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      case 'display':
        osc.frequency.setValueAtTime(740, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      case 'correct':
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.07, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.28);
          o.start(now + i * 0.08);
          o.stop(now + i * 0.08 + 0.28);
        });
        break;
      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.25);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      case 'keep':
        osc.frequency.setValueAtTime(480, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      default:
        break;
    }
  };

  let timeInterval = null;
  let countdownTimeout = null;
  let displayTimeout = null;
  let prevGameState = state.gameState;
  let lastDisplayIndexTone = -1;

  const clearCountdownTimer = () => {
    if (countdownTimeout) {
      clearTimeout(countdownTimeout);
      countdownTimeout = null;
    }
  };

  const clearDisplayTimer = () => {
    if (displayTimeout) {
      clearTimeout(displayTimeout);
      displayTimeout = null;
    }
  };

  const ensureTimer = () => {
    const shouldRun = ['countdown', 'display', 'input'].includes(state.gameState) && state.timeLeft > 0;
    if (shouldRun && !timeInterval) {
      timeInterval = setInterval(() => {
        if (state.timeLeft <= 1) {
          setState({ timeLeft: 0, gameState: 'summary' });
        } else {
          setState({ timeLeft: state.timeLeft - 1 });
        }
      }, 1000);
    }

    if (!shouldRun && timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
  };

  const updateCountdown = () => {
    clearCountdownTimer();
    if (state.gameState !== 'countdown') return;

    if (state.countdownVal > 0) {
      playTone('tick');
      countdownTimeout = setTimeout(() => {
        setState({ countdownVal: state.countdownVal - 1 });
      }, 800);
    } else {
      setState({
        displayIndex: 0,
        showNumber: true,
        gameState: 'display'
      });
    }
  };

  const updateDisplay = () => {
    clearDisplayTimer();
    if (state.gameState !== 'display') return;

    if (state.displayIndex >= state.sequence.length) {
      setState({ gameState: 'input' });
      return;
    }

    if (state.showNumber) {
      if (state.displayIndex !== lastDisplayIndexTone) {
        playTone('display');
        lastDisplayIndexTone = state.displayIndex;
      }
      displayTimeout = setTimeout(() => {
        setState({ showNumber: false });
      }, 800);
    } else {
      displayTimeout = setTimeout(() => {
        setState({
          displayIndex: state.displayIndex + 1,
          showNumber: true
        });
      }, 200);
    }
  };

  const setState = (patch) => {
    const nextState = { ...state, ...patch };
    const gameStateChanged = nextState.gameState !== prevGameState;
    Object.assign(state, patch);

    if (gameStateChanged) {
      clearCountdownTimer();
      clearDisplayTimer();
      lastDisplayIndexTone = -1;
      prevGameState = state.gameState;
    }

    render();
    postRender();
  };

  const postRender = () => {
    ensureTimer();
    if (state.gameState === 'countdown') updateCountdown();
    if (state.gameState === 'display') updateDisplay();
  };

  const startRound = (level) => {
    if (state.timeLeft <= 0) {
      setState({ gameState: 'summary' });
      return;
    }

    const newSequence = Array.from({ length: level }, () => Math.floor(Math.random() * 10));
    setState({
      digitCount: level,
      sequence: newSequence,
      userInput: '',
      countdownVal: 3,
      displayIndex: -1,
      showNumber: false,
      gameState: 'countdown'
    });
  };

  const startGame = () => {
    setState({
      timeLeft: state.gameDuration,
      scoreStats: {
        totalAttempts: 0,
        perfectClears: 0,
        maxLevel: state.digitCount,
        startLevel: state.digitCount,
        accuracySum: 0,
        currentStreak: 0,
        bestStreakThisRun: 0
      }
    });
    startRound(state.digitCount);
  };

  const quitGame = () => {
    if (window.confirm('ゲームを終了して結果画面へ移動しますか？')) {
      setState({ gameState: 'summary' });
    }
  };

  const handleNumberClick = (num) => {
    if (state.userInput.length < state.digitCount) {
      setState({ userInput: state.userInput + num });
      playTone('tick');
    }
  };

  const handleDelete = () => {
    setState({ userInput: state.userInput.slice(0, -1) });
  };

  const checkAnswer = () => {
    if (state.userInput.length === 0) return;

    const correctAnswer = [...state.sequence].reverse().join('');
    let matchCount = 0;
    for (let i = 0; i < correctAnswer.length; i++) {
      if (state.userInput[i] && state.userInput[i] === correctAnswer[i]) matchCount++;
    }
    const accuracy = matchCount / correctAnswer.length;
    const isPerfect = state.userInput === correctAnswer;

    let calculatedNextLevel = state.digitCount;
    let feedbackType = 'stay';
    let msg = '';

    if (isPerfect) {
      calculatedNextLevel = Math.min(state.digitCount + 1, 20);
      feedbackType = 'up';
      msg = 'Perfect!';
      playTone('correct');
    } else if (accuracy < 0.75) {
      calculatedNextLevel = Math.max(state.digitCount - 1, 3);
      feedbackType = 'down';
      msg = 'Level Down...';
      playTone('wrong');
    } else {
      feedbackType = 'stay';
      msg = 'Keep';
      playTone('keep');
    }

    const prev = state.scoreStats;
    const nextAttempts = prev.totalAttempts + 1;
    const nextPerfect = isPerfect ? prev.perfectClears + 1 : prev.perfectClears;
    const nextAccSum = prev.accuracySum + accuracy;
    const nextStreak = isPerfect ? prev.currentStreak + 1 : 0;
    const nextBestStreak = Math.max(prev.bestStreakThisRun, nextStreak);

    setState({
      scoreStats: {
        ...prev,
        totalAttempts: nextAttempts,
        perfectClears: nextPerfect,
        accuracySum: nextAccSum,
        currentStreak: nextStreak,
        bestStreakThisRun: nextBestStreak,
        maxLevel: Math.max(prev.maxLevel, isPerfect ? calculatedNextLevel : state.digitCount)
      },
      lastResult: {
        correctAnswer,
        userAnswer: state.userInput,
        isPerfect,
        accuracy,
        msg,
        type: feedbackType
      },
      nextLevel: calculatedNextLevel,
      gameState: 'feedback'
    });
  };

  const handleKeyDown = (e) => {
    if (state.gameState !== 'input') return;

    if (e.key >= '0' && e.key <= '9') handleNumberClick(e.key);
    else if (e.key === 'Backspace') handleDelete();
    else if (e.key === 'Enter') checkAnswer();
  };

  document.addEventListener('keydown', handleKeyDown);

  const icon = (label) => `<span class="icon" aria-hidden="true">${label}</span>`;

  const renderRules = () => `
    <div class="app-bg min-h-screen p-6 flex items-center justify-center">
      <div class="glass-card max-w-md w-full p-6 space-y-5">
        <div class="flex justify-between items-center">
          <h2 class="h-title flex items-center gap-2">
            ${icon('RULE')}
            ルール説明
          </h2>
          <button data-action="close-rules" class="icon-ghost" aria-label="閉じる">
            ${icon('X')}
          </button>
        </div>

        <div class="space-y-3 text-slate-700">
          <p>
            画面に表示される数字を覚え、<span class="font-extrabold text-rose-600">逆順</span>で入力してください。
          </p>
          <ul class="list-disc list-inside text-sm text-slate-600">
            <li>全問正解でレベルアップ</li>
            <li>正答率が低いとレベルダウン</li>
            <li>Enterで決定 / Backspaceで削除</li>
          </ul>
        </div>

        <button data-action="close-rules" class="btn-soft w-full">
          閉じる
        </button>
      </div>
    </div>
  `;

  const renderSetup = () => {
    const durationOptions = [
      { sec: 60, label: '1分' },
      { sec: 180, label: '3分' },
      { sec: 300, label: '5分' }
    ];

    return `
      <div class="app-bg min-h-screen flex items-center justify-center p-4">
        <div class="glass-card max-w-md w-full p-8 space-y-6 relative">
          <div class="badge">
            <img src="./favicon.ico" alt="タイトルアイコン" class="badge__img" />
          </div>

          <div class="text-center space-y-2">
            <h1 class="h-hero">カビ島教授の鬼トレ</h1>
            <p class="text-slate-600 text-sm">ワーキングメモリ強化（逆順入力）</p>
          </div>

          <div class="space-y-4">
            <div class="panel">
              <div class="flex items-center justify-between">
                <div>
                  <div class="panel__title">開始レベル</div>
                  <div class="panel__sub">3〜20</div>
                </div>

                <div class="flex items-center gap-3">
                  <button data-action="level-down" class="icon-btn" aria-label="レベルを下げる">
                    ${icon('v')}
                  </button>

                  <div class="level-pill" aria-label="開始レベル ${state.digitCount}">
                    <span class="level-pill__glow"></span>
                    <span class="level-pill__text">${state.digitCount}</span>
                  </div>

                  <button data-action="level-up" class="icon-btn icon-btn--accent" aria-label="レベルを上げる">
                    ${icon('^')}
                  </button>
                </div>
              </div>
            </div>

            <div class="panel">
              <div class="panel__title">制限時間</div>
              <div class="panel__sub">セッションの長さ</div>

              <div class="seg mt-3" role="tablist" aria-label="制限時間">
                ${durationOptions
                  .map((opt) => {
                    const active = state.gameDuration === opt.sec;
                    return `
                      <button
                        data-action="set-duration"
                        data-value="${opt.sec}"
                        class="seg__btn ${active ? 'is-active' : ''}"
                        role="tab"
                        aria-selected="${active}"
                      >
                        <span class="seg__btn-glow"></span>
                        ${opt.label}
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            </div>

            <div class="flex gap-2">
              <button data-action="toggle-sound" class="btn-soft flex-1">
                ${icon(state.soundEnabled ? 'ON' : 'OFF')}
                音: ${state.soundEnabled ? 'ON' : 'OFF'}
              </button>

              <button data-action="show-rules" class="btn-soft flex-1">
                ${icon('RULE')}
                ルール
              </button>
            </div>
          </div>

          <button data-action="start" class="btn-cta">
            <span class="btn-cta__glow"></span>
            ${icon('PLAY')} スタート
          </button>
        </div>
      </div>
    `;
  };

  const renderSummary = () => {
    const avgAccuracy = state.scoreStats.totalAttempts <= 0
      ? 0
      : state.scoreStats.accuracySum / state.scoreStats.totalAttempts;

    return `
      <div class="app-bg min-h-screen flex items-center justify-center p-4">
        <div class="glass-card max-w-md w-full p-8 space-y-6">
          <div class="text-center space-y-1">
            <h2 class="h-hero">おつかれさま！</h2>
            <p class="text-slate-600">今回の結果です</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="metric metric--indigo">
              <div class="metric__label">最高到達</div>
              <div class="metric__value">${state.scoreStats.maxLevel}桁</div>
            </div>
            <div class="metric metric--emerald">
              <div class="metric__label">Perfect</div>
              <div class="metric__value">${state.scoreStats.perfectClears}</div>
            </div>
            <div class="metric metric--amber">
              <div class="metric__label">連続Perfect</div>
              <div class="metric__value">${state.scoreStats.bestStreakThisRun}</div>
            </div>
            <div class="metric metric--cyan">
              <div class="metric__label">平均正答率</div>
              <div class="metric__value">${pct(avgAccuracy)}</div>
            </div>
          </div>

          <button data-action="back-to-setup" class="btn-cta">
            <span class="btn-cta__glow"></span>
            ${icon('R')} もう一回
          </button>
        </div>
      </div>
    `;
  };

  const renderFeedbackTiles = () => {
    const answer = state.lastResult.correctAnswer;
    const user = state.lastResult.userAnswer;
    const maxLen = Math.max(answer.length, user.length);

    return Array.from({ length: maxLen })
      .map((_, i) => {
        const userChar = user[i];
        const correctChar = answer[i];
        if (!userChar) return `<span class="tile tile--empty">-</span>`;
        const tone = userChar === correctChar ? 'tile--ok' : 'tile--ng';
        return `<span class="tile ${tone}">${userChar}</span>`;
      })
      .join('');
  };

  const renderGame = () => {
    const feedbackIcon = state.lastResult.type === 'up'
      ? `
        <svg viewBox="0 0 24 24" class="feedback-icon" aria-hidden="true">
          <path d="M12 4l6 6h-4v6h-4v-6H6l6-6z" />
        </svg>
      `
      : state.lastResult.type === 'down'
        ? `
          <svg viewBox="0 0 24 24" class="feedback-icon" aria-hidden="true">
            <path d="M12 20l-6-6h4V8h4v6h4l-6 6z" />
          </svg>
        `
        : `
          <svg viewBox="0 0 24 24" class="feedback-icon" aria-hidden="true">
            <path d="M9 12.5l2 2 4-4" />
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
          </svg>
        `;

    const mainContent = state.gameState === 'feedback'
      ? `
        <div class="glass-card w-full p-6 space-y-5">
          <div class="text-center">
            <div class="text-4xl mb-1 ${state.lastResult.type === 'up' ? 'animate-bounce' : ''}">
              ${feedbackIcon}
            </div>
            <h3 class="text-xl font-extrabold text-slate-900">${state.lastResult.msg}</h3>
            ${state.lastResult.type !== 'stay' ? `<p class="text-sm text-slate-600">次は ${state.nextLevel}桁</p>` : ''}
            <p class="text-xs text-slate-500 mt-1">正答率: ${pct(state.lastResult.accuracy)}</p>
          </div>

          <div class="panel space-y-3">
            <div>
              <p class="mini-title">正解 (逆順)</p>
              <div class="flex justify-center gap-1 font-mono text-xl font-extrabold text-slate-800 tracking-wider">
                ${state.lastResult.correctAnswer
                  .split('')
                  .map((char) => `<span class="tile">${char}</span>`)
                  .join('')}
              </div>
            </div>

            <div>
              <p class="mini-title">あなたの入力</p>
              <div class="flex justify-center gap-1 font-mono text-xl font-extrabold tracking-wider">
                ${renderFeedbackTiles()}
              </div>
            </div>
          </div>

          <button data-action="next-round" class="btn-cta">
            <span class="btn-cta__glow"></span>
            次へ進む ${icon('NEXT')}
          </button>
        </div>
      `
      : `
        ${state.gameState === 'countdown'
          ? `
            <div class="text-center">
              <div class="big-num animate-pulse">${state.countdownVal}</div>
              <p class="text-slate-600 mt-3">準備...</p>
            </div>
          `
          : state.gameState === 'display'
            ? `
              <div class="text-center">
                <div class="big-num-wrap">
                  ${state.showNumber && state.displayIndex < state.sequence.length
                    ? `<span class="big-num">${state.sequence[state.displayIndex]}</span>`
                    : `<span class="big-num big-num--ghost">_</span>`}
                </div>
                <p class="text-slate-600 mt-3">記憶中...</p>
              </div>
            `
            : state.gameState === 'input'
              ? `
                <div class="w-full space-y-5">
                  <div class="text-center space-y-2">
                    <h2 class="text-base font-extrabold text-slate-700">逆順で入力</h2>

                    <div class="input-monitor">
                      ${state.userInput
                        .split('')
                        .map((char) => `<span class="mx-1">${char}</span>`)
                        .join('')}
                      ${state.userInput.length === 0
                        ? '<span class="text-slate-400 text-sm font-sans">数字を入力</span>'
                        : ''}
                    </div>

                    <p class="text-xs text-slate-500">キーボード: 0-9 / Enter=決定 / Backspace=削除</p>
                  </div>

                  <div class="grid grid-cols-3 gap-3">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
                      .map(
                        (num) => `
                          <button data-action="input-digit" data-value="${num}" class="pad-btn">
                            ${num}
                          </button>
                        `
                      )
                      .join('')}

                    <button data-action="delete" class="pad-btn pad-btn--danger" aria-label="削除">
                      ${icon('DEL')}
                    </button>

                    <button data-action="input-digit" data-value="0" class="pad-btn">0</button>

                    <button
                      data-action="submit"
                      class="pad-btn pad-btn--cta ${state.userInput.length === 0 ? 'is-disabled' : ''}"
                      aria-label="決定"
                      ${state.userInput.length === 0 ? 'disabled' : ''}
                    >
                      ${icon('OK')}
                    </button>
                  </div>
                </div>
              `
              : ''}
      `;

    return `
      <div class="app-bg min-h-screen flex flex-col p-4">
        <button data-action="quit" class="quit-btn" title="ゲームを終了する">
          ${icon('QUIT')}
          <span class="font-extrabold">終了</span>
        </button>

        <div class="flex justify-between items-center mb-6 relative z-10">
          <div class="flex items-center gap-2 font-mono text-xl font-extrabold text-slate-800">
            ${icon('TIME')}
            ${formatTime(state.timeLeft)}
          </div>

          <div class="chip">Level ${state.digitCount}</div>
          <button data-action="back-to-title" class="ghost-btn" aria-label="タイトルに戻る">
            ${icon('HOME')}
            タイトル
          </button>
        </div>

        <div class="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
          ${mainContent}
        </div>
      </div>
    `;
  };

  const render = () => {
    switch (state.gameState) {
      case 'rules':
        root.innerHTML = renderRules();
        break;
      case 'setup':
        root.innerHTML = renderSetup();
        break;
      case 'summary':
        root.innerHTML = renderSummary();
        break;
      default:
        root.innerHTML = renderGame();
        break;
    }
  };

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const value = target.getAttribute('data-value');

    switch (action) {
      case 'close-rules':
        setState({ gameState: 'setup' });
        break;
      case 'show-rules':
        setState({ gameState: 'rules' });
        break;
      case 'level-down':
        setState({ digitCount: Math.max(3, state.digitCount - 1) });
        break;
      case 'level-up':
        setState({ digitCount: Math.min(20, state.digitCount + 1) });
        break;
      case 'set-duration':
        setState({ gameDuration: Number(value) });
        break;
      case 'toggle-sound':
        setState({ soundEnabled: !state.soundEnabled });
        break;
      case 'start':
        startGame();
        break;
      case 'back-to-setup':
        setState({ gameState: 'setup' });
        break;
      case 'back-to-title':
        setState({ gameState: 'setup' });
        break;
      case 'quit':
        quitGame();
        break;
      case 'input-digit':
        handleNumberClick(String(value));
        break;
      case 'delete':
        handleDelete();
        break;
      case 'submit':
        if (state.userInput.length > 0) checkAnswer();
        break;
      case 'next-round':
        startRound(state.nextLevel);
        break;
      default:
        break;
    }
  });

  render();
  postRender();
})();
