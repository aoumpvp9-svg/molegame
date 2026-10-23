/**
 * MOLE RUSH! — Arcade Whack-a-Mole Game Logic
 * Pure Vanilla JavaScript (No external libraries, No server)
 */

(() => {
  'use strict';

  // ==========================================
  // 1. 상수 및 DOM 엘리먼트 캐싱
  // ==========================================
  const TOTAL_GAME_TIME = 45; // 총 게임 시간 (초)
  const HIGH_SCORE_KEY = 'mole_rush_highscore';
  const COMBO_THRESHOLD = 3;  // 콤보 보너스 발동 기준
  const COMBO_BONUS_POINTS = 5; // 3콤보 이상 시 추가 보너스 점수

  // 두더지 종류 정의
  const MOLE_TYPES = {
    NORMAL: {
      id: 'normal',
      name: '일반 두더지',
      icon: '🐹',
      hitIcon: '😵',
      points: 10,
      weight: 70 // 출현 확률 가중치 70%
    },
    GOLDEN: {
      id: 'golden',
      name: '황금 두더지',
      icon: '👑🐹',
      hitIcon: '✨🤩',
      points: 30,
      weight: 15 // 출현 확률 가중치 15%
    },
    BOMB: {
      id: 'bomb',
      name: '폭탄 두더지',
      icon: '💣',
      hitIcon: '💥',
      points: -15, // 감점 (0점 미만 방지)
      weight: 15 // 출현 확률 가중치 15%
    }
  };

  // DOM 요소
  const highScoreEl = document.getElementById('highScore');
  const currentScoreEl = document.getElementById('currentScore');
  const scoreCardEl = document.getElementById('scoreCard');
  const timeLeftEl = document.getElementById('timeLeft');
  const timeCardEl = document.getElementById('timeCard');
  const timerBarEl = document.getElementById('timerBar');
  const currentComboEl = document.getElementById('currentCombo');
  const comboCardEl = document.getElementById('comboCard');
  const comboBonusTagEl = document.getElementById('comboBonusTag');
  const moleBoardEl = document.getElementById('moleBoard');
  const holes = document.querySelectorAll('.hole');
  const startBtn = document.getElementById('startBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIconEl = document.getElementById('soundIcon');

  // 모달 요소
  const resultModal = document.getElementById('resultModal');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalEmojiEl = document.getElementById('modalEmoji');
  const newRecordBadgeEl = document.getElementById('newRecordBadge');
  const finalScoreEl = document.getElementById('finalScore');
  const maxComboDisplayEl = document.getElementById('maxComboDisplay');
  const modalHighScoreEl = document.getElementById('modalHighScore');
  const restartBtn = document.getElementById('restartBtn');

  // ==========================================
  // 2. 게임 상태 (Game State)
  // ==========================================
  let isPlaying = false;
  let score = 0;
  let timeLeft = TOTAL_GAME_TIME;
  let combo = 0;
  let maxCombo = 0;
  let highScore = 0;
  let soundEnabled = true;

  // 타이머 & 제어 변수
  let gameIntervalId = null;
  let moleTimerId = null;
  let currentHoleIndex = -1;
  let currentMoleType = null;
  let hasHitCurrentMole = false;

  // ==========================================
  // 3. 네이티브 사운드 신디사이저 (Web Audio API)
  // ==========================================
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'hit_normal') {
        // 통통 튀는 경쾌한 타격음
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit_golden') {
        // 반짝이는 황금 보너스음
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'hit_bomb') {
        // 폭탄 쾅! 디센딩 저음
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'combo') {
        // 콤보 상승 치솟는 소리
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'gameover') {
        // 게임오버 아르페지오
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(523.25, now + 0.15);
        osc.frequency.setValueAtTime(440, now + 0.3);
        osc.frequency.setValueAtTime(329.63, now + 0.45);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch (e) {
      // 오디오 미지원 환경 예외 무시
    }
  }

  // ==========================================
  // 4. 로컬 스토리지 (최고 점수)
  // ==========================================
  function loadHighScore() {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      highScore = 0;
    }
    updateHighScoreUI();
  }

  function saveHighScore(newScore) {
    if (newScore > highScore) {
      highScore = newScore;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
      } catch (e) {
        // 스토리지 제한 시 무시
      }
      updateHighScoreUI();
      return true; // 신기록 갱신 여부 반환
    }
    return false;
  }

  function updateHighScoreUI() {
    if (highScoreEl) highScoreEl.textContent = highScore;
    if (modalHighScoreEl) modalHighScoreEl.textContent = highScore;
  }

  // ==========================================
  // 5. 난이도 및 랜덤 계산 로직
  // ==========================================

  /**
   * 남은 시간에 따라 머무는 시간(stayDuration)과
   * 다음 등장 대기 시간(delayDuration)을 점진적으로 단축
   */
  function getDifficultyConfig() {
    // 45초 기준
    if (timeLeft > 32) {
      return { stayTime: 950, delayTime: 280 }; // 초반: 여유
    } else if (timeLeft > 18) {
      return { stayTime: 780, delayTime: 220 }; // 중반: 가속
    } else if (timeLeft > 7) {
      return { stayTime: 620, delayTime: 180 }; // 후반: 스피드
    } else {
      return { stayTime: 480, delayTime: 140 }; // 막판: 초고속
    }
  }

  /**
   * 가중치 기반 두더지 종류 무작위 선택
   */
  function getRandomMoleType() {
    const roll = Math.random() * 100;
    if (roll < MOLE_TYPES.NORMAL.weight) {
      return MOLE_TYPES.NORMAL;
    } else if (roll < MOLE_TYPES.NORMAL.weight + MOLE_TYPES.GOLDEN.weight) {
      return MOLE_TYPES.GOLDEN;
    } else {
      return MOLE_TYPES.BOMB;
    }
  }

  /**
   * 이전에 나온 구멍과 중복되지 않도록 다음 구멍 선택
   */
  function getRandomHoleIndex() {
    const totalHoles = holes.length;
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * totalHoles);
    } while (nextIndex === currentHoleIndex && totalHoles > 1);
    return nextIndex;
  }

  // ==========================================
  // 6. UI 갱신 함수들
  // ==========================================
  function updateScoreUI(bump = true) {
    currentScoreEl.textContent = score;
    if (bump) {
      scoreCardEl.classList.remove('score-bump');
      // 리플로우 강제 후 애니메이션 재생
      void scoreCardEl.offsetWidth;
      scoreCardEl.classList.add('score-bump');
    }
  }

  function updateComboUI() {
    currentComboEl.textContent = combo;

    if (combo >= COMBO_THRESHOLD) {
      comboCardEl.classList.add('fever', 'active-combo');
      comboBonusTagEl.classList.remove('hidden');
    } else if (combo > 0) {
      comboCardEl.classList.add('active-combo');
      comboCardEl.classList.remove('fever');
      comboBonusTagEl.classList.add('hidden');
    } else {
      comboCardEl.classList.remove('active-combo', 'fever');
      comboBonusTagEl.classList.add('hidden');
    }
  }

  function updateTimerUI() {
    timeLeftEl.innerHTML = `${timeLeft}<small>s</small>`;
    const percent = Math.max(0, (timeLeft / TOTAL_GAME_TIME) * 100);
    timerBarEl.style.width = `${percent}%`;

    // 10초 이하일 때 긴박한 붉은색 효과
    if (timeLeft <= 10) {
      timeCardEl.classList.add('urgent');
    } else {
      timeCardEl.classList.remove('urgent');
    }
  }

  /**
   * 타격 점수 플로팅 효과 표시
   */
  function showFloatingEffect(holeEl, text, className, subText = null) {
    const container = holeEl.querySelector('.floating-effect');
    if (!container) return;

    container.innerHTML = '';
    const span = document.createElement('span');
    span.className = `popup-text ${className}`;
    span.textContent = text;
    container.appendChild(span);

    if (subText) {
      const subSpan = document.createElement('span');
      subSpan.className = 'popup-text combo-extra';
      subSpan.textContent = subText;
      container.appendChild(subSpan);
    }

    setTimeout(() => {
      container.innerHTML = '';
    }, 800);
  }

  // ==========================================
  // 7. 두더지 출몰 사이클
  // ==========================================

  /**
   * 구멍에서 현재 캐릭터를 숨김
   */
  function hideCurrentMole() {
    if (currentHoleIndex !== -1 && holes[currentHoleIndex]) {
      const prevHole = holes[currentHoleIndex];
      prevHole.classList.remove('up', 'hit', 'bomb-hit', 'type-golden', 'type-bomb');
      
      const moleCharEl = prevHole.querySelector('.mole-char');
      if (moleCharEl) moleCharEl.textContent = '';
    }

    // 만약 일반/황금 두더지가 맞지 않고 그냥 내려갔다면 -> 콤보 리셋
    if (!hasHitCurrentMole && currentMoleType && currentMoleType.id !== 'bomb') {
      if (combo > 0) {
        combo = 0;
        updateComboUI();
      }
    }

    currentHoleIndex = -1;
    currentMoleType = null;
    hasHitCurrentMole = false;
  }

  /**
   * 다음 두더지 출현 예약
   */
  function scheduleNextMole() {
    if (!isPlaying) return;

    const { delayTime } = getDifficultyConfig();
    moleTimerId = setTimeout(() => {
      if (!isPlaying) return;
      spawnMole();
    }, delayTime);
  }

  /**
   * 두더지 1마리 출현
   */
  function spawnMole() {
    if (!isPlaying) return;

    hideCurrentMole();

    const { stayTime } = getDifficultyConfig();
    currentHoleIndex = getRandomHoleIndex();
    currentMoleType = getRandomMoleType();
    hasHitCurrentMole = false;

    const holeEl = holes[currentHoleIndex];
    const moleCharEl = holeEl.querySelector('.mole-char');

    // 캐릭터 이모지 및 타입 클래스 세팅
    if (moleCharEl) {
      moleCharEl.textContent = currentMoleType.icon;
    }

    if (currentMoleType.id === 'golden') {
      holeEl.classList.add('type-golden');
    } else if (currentMoleType.id === 'bomb') {
      holeEl.classList.add('type-bomb');
    }

    // 튀어나오기 시작
    holeEl.classList.add('up');

    // stayTime 이후 자동으로 들어감
    moleTimerId = setTimeout(() => {
      if (!isPlaying) return;
      hideCurrentMole();
      scheduleNextMole();
    }, stayTime);
  }

  // ==========================================
  // 8. 클릭 및 타격 판정 (Hit Logic)
  // ==========================================
  function handleHoleClick(index) {
    if (!isPlaying) return;
    if (index !== currentHoleIndex) return;
    if (hasHitCurrentMole) return; // 한 번 등장한 캐릭터는 1회만 판정

    hasHitCurrentMole = true;
    const holeEl = holes[index];
    const moleCharEl = holeEl.querySelector('.mole-char');

    if (currentMoleType.id === 'normal') {
      // 일반 두더지 타격
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      let gained = currentMoleType.points;
      let comboExtraText = null;

      // 3콤보 이상 보너스
      if (combo >= COMBO_THRESHOLD) {
        gained += COMBO_BONUS_POINTS;
        comboExtraText = `COMBO +${COMBO_BONUS_POINTS}!`;
        playSound('combo');
      } else {
        playSound('hit_normal');
      }

      score += gained;
      updateScoreUI();
      updateComboUI();

      if (moleCharEl) moleCharEl.textContent = currentMoleType.hitIcon;
      holeEl.classList.add('hit');
      showFloatingEffect(holeEl, `+${currentMoleType.points}`, 'plus-normal', comboExtraText);

    } else if (currentMoleType.id === 'golden') {
      // 황금 두더지 타격
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      let gained = currentMoleType.points;
      let comboExtraText = null;

      if (combo >= COMBO_THRESHOLD) {
        gained += COMBO_BONUS_POINTS;
        comboExtraText = `COMBO +${COMBO_BONUS_POINTS}!`;
      }
      playSound('hit_golden');

      score += gained;
      updateScoreUI();
      updateComboUI();

      if (moleCharEl) moleCharEl.textContent = currentMoleType.hitIcon;
      holeEl.classList.add('hit');
      showFloatingEffect(holeEl, `+${currentMoleType.points} GOLD!`, 'plus-golden', comboExtraText);

    } else if (currentMoleType.id === 'bomb') {
      // 폭탄 타격 (감점 & 콤보 초기화)
      score = Math.max(0, score + currentMoleType.points); // 0점 미만 방지
      combo = 0;
      updateScoreUI();
      updateComboUI();
      playSound('hit_bomb');

      // 화면 흔들림 효과
      document.body.classList.remove('shake');
      void document.body.offsetWidth;
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 450);

      if (moleCharEl) moleCharEl.textContent = currentMoleType.hitIcon;
      holeEl.classList.add('bomb-hit');
      showFloatingEffect(holeEl, `${currentMoleType.points}`, 'minus-bomb');
    }

    // 맞았으면 잠시 후 바로 쏙 들어가고 다음 두더지 출현
    clearTimeout(moleTimerId);
    moleTimerId = setTimeout(() => {
      if (!isPlaying) return;
      hideCurrentMole();
      scheduleNextMole();
    }, 280);
  }

  // ==========================================
  // 9. 게임 시작 및 종료 사이클
  // ==========================================
  function startGame() {
    if (isPlaying) return; // 중복 실행 방지
    initAudioContext();

    // 상태 초기화
    isPlaying = true;
    score = 0;
    timeLeft = TOTAL_GAME_TIME;
    combo = 0;
    maxCombo = 0;
    currentHoleIndex = -1;
    currentMoleType = null;
    hasHitCurrentMole = false;

    // UI 초기화
    updateScoreUI(false);
    updateComboUI();
    updateTimerUI();
    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    resultModal.classList.add('hidden');

    // 기존 타이머 클리어
    clearInterval(gameIntervalId);
    clearTimeout(moleTimerId);
    hideCurrentMole();

    // 1초 단위 타이머 시작
    gameIntervalId = setInterval(() => {
      timeLeft--;
      updateTimerUI();

      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);

    // 두더지 출몰 루프 시작
    scheduleNextMole();
  }

  function endGame() {
    if (!isPlaying) return;
    isPlaying = false;

    // 모든 타이머 정리
    clearInterval(gameIntervalId);
    clearTimeout(moleTimerId);
    gameIntervalId = null;
    moleTimerId = null;

    hideCurrentMole();
    playSound('gameover');

    // 최고 점수 갱신 확인
    const isNewRecord = saveHighScore(score);

    // 시작 버튼 복원
    startBtn.disabled = false;
    startBtn.style.opacity = '1';

    // 결과 모달 팝업 표시
    finalScoreEl.textContent = score;
    maxComboDisplayEl.textContent = maxCombo;
    modalHighScoreEl.textContent = highScore;

    if (isNewRecord && score > 0) {
      newRecordBadgeEl.classList.remove('hidden');
      modalEmojiEl.textContent = '🏆';
      modalTitleEl.textContent = 'NEW RECORD!';
    } else {
      newRecordBadgeEl.classList.add('hidden');
      modalEmojiEl.textContent = score >= 200 ? '🎉' : '👏';
      modalTitleEl.textContent = 'GAME OVER';
    }

    resultModal.classList.remove('hidden');
  }

  // ==========================================
  // 10. 이벤트 리스너 등록
  // ==========================================
  function bindEvents() {
    // 시작 버튼 클릭
    startBtn.addEventListener('click', () => {
      startGame();
    });

    // 다시 하기 버튼 클릭
    restartBtn.addEventListener('click', () => {
      resultModal.classList.add('hidden');
      startGame();
    });

    // 스페이스바로도 시작/다시 하기 가능
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (!isPlaying) {
          e.preventDefault();
          resultModal.classList.add('hidden');
          startGame();
        }
      }
    });

    // 사운드 On/Off 토글
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        soundToggleBtn.classList.remove('muted');
        soundIconEl.textContent = '🔊';
        initAudioContext();
      } else {
        soundToggleBtn.classList.add('muted');
        soundIconEl.textContent = '🔇';
      }
    });

    // 9개 구멍 클릭 이벤트 등록 (이벤트 위임 또는 각 홀 바인딩)
    holes.forEach((hole, idx) => {
      hole.addEventListener('pointerdown', (e) => {
        // e.preventDefault();
        handleHoleClick(idx);
      });
    });
  }

  // ==========================================
  // 11. 초기 실행
  // ==========================================
  loadHighScore();
  bindEvents();
})();
