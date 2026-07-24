const REVIEW_UNPIN_BUTTON_LEFT = '87%';
const REVIEW_UNPIN_BUTTON_TOP = '4.2%';
const MOCK_REPLIES = [
  "我在呢，慢慢说。",
  "听起来这件事真的让你很难受。",
  "你可以再多告诉我一点吗？",
  "我会先帮你把这份烦恼接住。"
];

const GREETING_MESSAGE = "我在呢，慢慢说。今天发生了什么让你不开心呀？";

const SUMMARY_BLOCKS = {
  primary: '忧忧已经替你收下了\n这一份烦恼。',
  count: '目前承载着 1 根针。',
  secondary: '如果还有放不下的烦恼，\n就继续向忧忧扎下一针吧。💜'
};

const PIN_FLYING_SIZE = '22%';

const PAIN_DOT_CHAT_SIZE = '12%';
const PAIN_DOT_LANDING_SIZE = '12%';

const PIN_FLYING_ROTATION = '-25deg';
const PIN_STUCK_ROTATION = '0deg';

const EPHEMERAL_BOT_MESSAGES = new Set([
  '…',
  '...',
  '忧忧正在帮你整理这件事...',
  '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。'
]);

let chatSendBtn = null;
let isChatRequestInFlight = false;

function setChatControlsDisabled(disabled) {
  if (chatInput) {
    chatInput.disabled = disabled;
  }

  if (chatSendBtn) {
    chatSendBtn.disabled = disabled;
  }
}

function isEphemeralBotMessage(text) {
  return EPHEMERAL_BOT_MESSAGES.has(text);
}


function injectChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .chat-panel {
      position: absolute;
      left: 4%;
      top: 45%;
      width: 92%;
      height: 50%;
      display: flex;
      flex-direction: column;
    }

    .chat-log {
      flex: 1;
      height: 82%;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .chat-log::-webkit-scrollbar {
      width: 4px;
    }

    .chat-log::-webkit-scrollbar-track {
      background: transparent;
    }

    .chat-log::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .chat-message {
      display: flex;
      gap: 8px;
      max-width: 85%;
    }

    .chat-message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .chat-message.bot {
      align-self: flex-start;
    }

    .chat-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .chat-avatar.user {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .chat-avatar.bot {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }

    .chat-bubble {
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .chat-message.user .chat-bubble {
      background: rgba(102, 126, 234, 0.9);
      color: white;
      border-bottom-right-radius: 6px;
    }

    .chat-message.bot .chat-bubble {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border-bottom-left-radius: 6px;
    }

    .chat-input-area {
      height: 12%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 24px;
      margin-top: auto;
    }

    .chat-input {
      flex: 1;
      background: rgba(102, 126, 234, 0.3);
      border: none;
      outline: none;
      padding: 10px 16px;
      border-radius: 20px;
      color: white;
      font-size: 14px;
    }

    .chat-input::placeholder {
      color: rgba(255, 255, 255, 0.6);
    }

    .chat-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      outline: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
    }

    .chat-log.ceremony-fade {
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 450ms ease, transform 450ms ease;
    }

    .chat-input-area.ceremony-slide {
      opacity: 0;
      transform: translateY(30px);
      transition: opacity 450ms ease, transform 450ms ease;
    }

    .ceremony-projectile {
      position: absolute;
      width: var(--pin-flying-size, 22%);
      pointer-events: none;
      z-index: 20;
      transform-origin: center center;
    }

    .ceremony-projectile.animating {
      transition: left 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  top 800ms cubic-bezier(0.68, -0.55, 0.27, 1.55),
                  transform 800ms ease-out;
    }

    .pin-stuck {
      position: absolute;
      width: var(--pin-stuck-size, 15%);
      pointer-events: none;
      z-index: 15;
      transform: translate(-50%, -50%);
      transform-origin: center center;
    }

    .pin-stuck.landing {
      animation: pinStuckLanding 200ms ease;
    }

    @keyframes pinStuckLanding {
      0% { transform: translate(-50%, -50%) scale(0.8); }
      50% { transform: translate(-50%, -50%) scale(1.15); }
      100% { transform: translate(-50%, -50%) scale(1); }
    }

    .pain-dot.landing {
      animation: painDotLanding 200ms ease;
    }

    @keyframes painDotLanding {
      0% { transform: translate(-50%, -50%) scale(0.8); }
      50% { transform: translate(-50%, -50%) scale(1.15); }
      100% { transform: translate(-50%, -50%) scale(1); }
    }

    .ceremony-glow {
      position: absolute;
      width: 24%;
      aspect-ratio: 1;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      z-index: 10;

      background:
        radial-gradient(circle,
          rgba(225,185,255,0.95) 0%,
          rgba(195,120,255,0.75) 28%,
          rgba(165,90,255,0.45) 58%,
          rgba(150,70,255,0.18) 78%,
          transparent 100%);
}

    .ceremony-glow.impact {
      animation: glowExpand 500ms ease-out;
    }

    @keyframes glowExpand {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }

    .summary-panel {
      position: absolute;
      left: 4%;
      top: 45%;
      width: 92%;
      height: 50%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      color: white;
      padding: 30px 20px 20px;
      opacity: 0;
      transform: translateY(30px);
      transition: opacity 400ms ease, transform 400ms ease;
      gap: 16px;
      background: linear-gradient(
        135deg,
        rgba(102, 51, 153, 0.45),
        rgba(75, 0, 130, 0.4),
        rgba(48, 0, 82, 0.45)
      );
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    }

    .summary-panel.show {
      opacity: 1;
      transform: translateY(0);
    }

    .summary-line {
      margin: 0;
      max-width: 270px;
      white-space: pre-line;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .summary-line.core-issue {
      max-width: 92%;
      font-size: 19px;
      font-weight: 600;
      line-height: 1.35;
      text-align: center;
      word-break: keep-all;
      overflow-wrap: normal;
      text-wrap: balance;
    }

    .summary-line.primary {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.5;
    }

    .summary-line.count {
      font-size: 17px;
      font-weight: 500;
      line-height: 1.4;
    }

    .summary-line.secondary {
      font-size: 15px;
      font-weight: 400;
      line-height: 1.4;
      opacity: 0.9;
    }

    .summary-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
      padding-bottom: 10px;
      width: 100%;
    }

    .summary-btn {
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 500;
      color: white;
      cursor: pointer;
      background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
      box-shadow: 0 4px 15px rgba(155, 89, 182, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      transition: all 0.2s ease;
      width: 100%;
      text-align: center;
    }

    .summary-btn:hover {
      background: linear-gradient(135deg, #a86cb8 0%, #9b59b6 100%);
      box-shadow: 0 4px 20px rgba(155, 89, 182, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
      transform: translateY(-1px);
    }

    .summary-btn:active {
      transform: translateY(1px);
      opacity: 0.9;
    }

    .chat-separator {
      text-align: center;
      color: rgba(180, 160, 255, 0.8);
      font-size: 13px;
      padding: 8px 0;
      margin: 4px 0;
      position: relative;
    }

    .chat-separator::before,
    .chat-separator::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 25%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(180, 160, 255, 0.4), transparent);
    }

    .chat-separator::before {
      left: 0;
    }

    .chat-separator::after {
      right: 0;
    }

    .review-chat-fade-out {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 450ms ease, transform 450ms ease;
      pointer-events: none;
    }

    .needle-release-ripple {
      position: absolute;
      width: 24%;
      aspect-ratio: 1;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      z-index: 55;
      transform: translate(-50%, -50%) scale(0.45);
      background:
        radial-gradient(circle,
          rgba(225,185,255,0.95) 0%,
          rgba(195,120,255,0.68) 30%,
          rgba(165,90,255,0.35) 58%,
          rgba(150,70,255,0.14) 78%,
          transparent 100%);
    }

    .needle-release-ripple.impact {
      animation: needleReleaseRipple 700ms ease-out forwards;
    }

    @keyframes needleReleaseRipple {
      0% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(0.45);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(2.7);
      }
    }

    .needle-fade-away {
      z-index: 60;
      animation: needleFadeAway 1200ms ease-in-out forwards;
      will-change: opacity, transform, filter;
    }

    @keyframes needleFadeAway {
      0% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
        filter: blur(0);
      }
      35% {
        opacity: 0.82;
        transform: translate(-50%, -38%) scale(0.97) rotate(0.5deg);
        filter: blur(0.8px);
      }
      70% {
        opacity: 0.38;
        transform: translate(-50%, -18%) scale(0.91) rotate(0deg);
        filter: blur(2.5px);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, 4%) scale(0.84) rotate(0deg);
        filter: blur(5px);
      }
    }

    .release-celebration-btn {
      display: flex;
      flex-direction: column;
      width: 356px;
      padding-top: 16px;
      padding-bottom: 16px;
      padding-left: 24px;
      padding-right: 24px;
      font-size: 16px;
      font-weight: 600;
      color: white;
      background: linear-gradient(135deg, #9d4edd 0%, #7b2cbf 50%, #5a189a 100%);
      border: none;
      border-radius: 32px;
      box-shadow: 0 6px 20px rgba(157, 78, 221, 0.5), 0 0 30px rgba(157, 78, 221, 0.3);
      cursor: pointer;
      z-index: 90;
      opacity: 0;
      animation: celebrationBtnFadeIn 400ms ease-out 300ms forwards;
    }

    .release-celebration-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 25px rgba(157, 78, 221, 0.6), 0 0 40px rgba(157, 78, 221, 0.4);
    }

    .release-celebration-btn:active {
      transform: scale(0.98);
    }

    @keyframes celebrationBtnFadeIn {
      0% {
        opacity: 0;
        transform: translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .release-confetti-overlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 200;
      pointer-events: none;
      opacity: 0;
      animation: releaseConfettiFall 2800ms ease-in-out forwards;
      transition: opacity 800ms ease-out;
    }

    .release-confetti-overlay.celebration-fading {
      opacity: 0 !important;
    }

    @keyframes releaseConfettiFall {
      0% {
        opacity: 0;
        transform: translateY(-4%) translateX(0) scale(1.03);
      }
      15% {
        opacity: 1;
        transform: translateY(-1%) translateX(-1px) scale(1.03);
      }
      65% {
        opacity: 1;
        transform: translateY(2%) translateX(1px) scale(1.035);
      }
      100% {
        opacity: 0;
        transform: translateY(9%) translateX(0) scale(1.03);
      }
    }

    .release-celebration-text {
      position: absolute;
      top: 8%;
      left: 50%;
      width: 86%;
      transform: translateX(-50%) translateY(-8px);
      z-index: 210;
      pointer-events: none;
      text-align: center;
      color: #fff7ff;
      font-weight: 700;
      letter-spacing: 0.03em;
      line-height: 1.45;
      text-shadow:
        0 0 10px rgba(210, 150, 255, 0.95),
        0 0 24px rgba(150, 80, 255, 0.75),
        0 3px 10px rgba(0, 0, 0, 0.45);
      padding: 14px 18px;
      border-radius: 22px;
      background: linear-gradient(
        135deg,
        rgba(112, 66, 190, 0.28),
        rgba(190, 104, 255, 0.18)
      );
      border: 1px solid rgba(255, 220, 255, 0.22);
      backdrop-filter: blur(6px);
      animation: releaseTextAppear 2800ms ease-in-out forwards;
      transition: opacity 800ms ease-out;
    }

    .release-celebration-text.celebration-fading {
      opacity: 0 !important;
    }

    .release-celebration-text .release-title {
      display: block;
      font-size: 22px;
      margin-bottom: 8px;
    }

    .release-celebration-text .release-subtitle {
      display: block;
      font-size: 15px;
      font-weight: 500;
      opacity: 0.95;
    }

    @keyframes releaseTextAppear {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(-12px) scale(0.96);
      }
      15% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
      65% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) translateY(4px) scale(0.98);
      }
    }

    .persistent-unpin-btn {
      position: absolute;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 500;
      color: white;
      background: linear-gradient(135deg, rgba(240, 147, 251, 0.9) 0%, rgba(245, 87, 108, 0.9) 100%);
      border: none;
      border-radius: 20px;
      box-shadow: 0 3px 12px rgba(245, 87, 108, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
      cursor: pointer;
      z-index: 70;
      opacity: 0;
      transition: opacity 300ms ease, transform 300ms ease, box-shadow 200ms ease;
      pointer-events: none;
      white-space: nowrap;
    }

    .persistent-unpin-btn.show {
      opacity: 1;
      pointer-events: auto;
    }

    .persistent-unpin-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(245, 87, 108, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
    }

    .persistent-unpin-btn:active {
      transform: scale(0.96);
    }
  `;
  document.head.appendChild(style);
}

function showReleaseCelebrationButton(onContinue) {
  const btn = document.createElement('button');
  btn.className = 'release-celebration-btn';
  btn.textContent = '庆祝这针情绪退散了！';

  btn.addEventListener('click', () => {
    if (btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
    if (onContinue) {
      onContinue();
    }
  });

  const buttonsContainer = chatScreen.querySelector('.summary-buttons');
  if (buttonsContainer) {
    buttonsContainer.appendChild(btn);
  } else {
    chatScreen.appendChild(btn);
  }
}

function showReleaseConfettiOverlay() {
  const existingConfetti = homeScreen.querySelector('.release-confetti-overlay');
  if (existingConfetti) {
    existingConfetti.parentNode.removeChild(existingConfetti);
  }

  const confetti = document.createElement('img');
  confetti.className = 'release-confetti-overlay';
  confetti.src = '/assets/effects/release-confetti.png';
  homeScreen.appendChild(confetti);

  if (window.AudioManager && AudioManager.playCelebrationSound) {
    AudioManager.playCelebrationSound();
  }

  // Start coordinated fade after main animation (2000ms display + 800ms fade)
  setTimeout(() => {
    startCelebrationFade();
  }, 2000);
}
window.showReleaseConfettiOverlay = showReleaseConfettiOverlay;

function showReleaseCelebrationText() {
  const existingText = homeScreen.querySelector('.release-celebration-text');
  if (existingText) {
    existingText.parentNode.removeChild(existingText);
  }

  const textEl = document.createElement('div');
  textEl.className = 'release-celebration-text';
  textEl.innerHTML = `
    <span class="release-title">✨恭喜你呀！放下了一针烦恼！✨</span>
    <span class="release-subtitle">你看，这根针没有想象中那么难拔吧！以后有烦恼，记得来找忧忧哦！</span>
  `;

  homeScreen.appendChild(textEl);
}
window.showReleaseCelebrationText = showReleaseCelebrationText;

// Coordinated fade-out for confetti and celebration text
function startCelebrationFade() {
  if (DEV_MODE) console.log('[CELEBRATION DEBUG] coordinated fade started');

  const CONFETTI_FADE_DURATION = 800;

  const confetti = homeScreen.querySelector('.release-confetti-overlay');
  const textEl = homeScreen.querySelector('.release-celebration-text');

  // Add fading class to both elements
  if (confetti) {
    confetti.classList.add('celebration-fading');
  }
  if (textEl) {
    textEl.classList.add('celebration-fading');
  }

  // Remove elements after fade completes
  setTimeout(() => {
    if (confetti && confetti.parentNode) {
      confetti.parentNode.removeChild(confetti);
      if (DEV_MODE) console.log('[CELEBRATION DEBUG] confetti removed');
    }
    if (textEl && textEl.parentNode) {
      textEl.parentNode.removeChild(textEl);
      if (DEV_MODE) console.log('[CELEBRATION DEBUG] celebration panel removed');
    }
  }, CONFETTI_FADE_DURATION);
}

function showPersistentUnpinButton() {
  const existingBtn = chatScreen.querySelector('.persistent-unpin-btn');
  if (existingBtn) {
    existingBtn.parentNode.removeChild(existingBtn);
  }

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.reviewingPinId) {
    if (DEV_MODE) console.log('[REVIEW DEBUG] showPersistentUnpinButton - no reviewingPinId');
    return;
  }

  const pinId = currentUser.reviewingPinId;
  const pinElement = chatScreen.querySelector(`.pin-stuck[data-pin-id="${pinId}"]`);

  if (!pinElement) {
    if (DEV_MODE) console.log('[REVIEW DEBUG] showPersistentUnpinButton - pin element not found');
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'persistent-unpin-btn';
  btn.textContent = '聊开了\n取下这根针';

  btn.addEventListener('click', () => {
    if (DEV_MODE) {
      console.log('[REVIEW DEBUG] persistent unpin clicked, direct celebration');
      console.log('[REVIEW DEBUG] removed intermediate post-removal celebration button');
    }
    removeReviewedNeedleWithAnimation();
  });

  chatScreen.appendChild(btn);

  const updateButtonPosition = () => {
  btn.style.left = REVIEW_UNPIN_BUTTON_LEFT;
  btn.style.top = REVIEW_UNPIN_BUTTON_TOP;
  btn.style.transform = 'translate(-50%, -50%)';
};

  setTimeout(() => {
    updateButtonPosition();
    btn.classList.add('show');
  }, 300);

  if (DEV_MODE) console.log('[REVIEW DEBUG] persistent unpin button created near needle');
}
window.showPersistentUnpinButton = showPersistentUnpinButton;

function hidePersistentUnpinButton() {
  const existingBtn = chatScreen.querySelector('.persistent-unpin-btn');
  if (existingBtn) {
    existingBtn.classList.remove('show');
    setTimeout(() => {
      if (existingBtn.parentNode) {
        existingBtn.parentNode.removeChild(existingBtn);
      }
    }, 300);
  }
}
window.hidePersistentUnpinButton = hidePersistentUnpinButton;

let chatPanel = null;
let chatLog = null;
let chatInput = null;

function initChatScreen() {
  injectChatStyles();

  const existingPanel = chatScreen.querySelector('.chat-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';

  chatLog = document.createElement('div');
  chatLog.className = 'chat-log';

  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';

  chatInput = document.createElement('input');
  chatInput.className = 'chat-input';
  chatInput.type = 'text';
  chatInput.placeholder = '把今天的烦恼告诉忧忧…';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'chat-send-btn';
  sendBtn.textContent = '→';
  chatSendBtn = sendBtn;

  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);

  chatPanel.appendChild(chatLog);
  chatPanel.appendChild(inputArea);

  chatScreen.appendChild(chatPanel);

  chatInput.addEventListener('keydown', handleChatInput);
  sendBtn.addEventListener('click', sendMessage);

  loadChatHistory();
}
window.showChatInterface = initChatScreen;

function handleChatInput(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendAutoReviewMessage(text) {
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] =========================');
    console.log('[REVIEW DEBUG] sendAutoReviewMessage called');
    console.log('[REVIEW DEBUG] text:', text);
    console.log('[REVIEW DEBUG] STABIT_CHAT_MODE:', window.STABIT_CHAT_MODE);
  }

  if (!text) {
    if (DEV_MODE) console.warn('[REVIEW DEBUG] sendAutoReviewMessage called with empty text');
    return;
  }

  if (window.STABIT_CHAT_MODE !== 'review') {
    if (DEV_MODE) console.warn('[REVIEW DEBUG] sendAutoReviewMessage called but mode is not review');
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.reviewingPinId) {
    if (DEV_MODE) console.warn('[REVIEW DEBUG] sendAutoReviewMessage called but no reviewingPinId');
    return;
  }

  if (isChatRequestInFlight) {
    if (DEV_MODE) console.log('[REVIEW DEBUG] sendAutoReviewMessage - ignoring, request in flight');
    return;
  }

  const chatPin = getCurrentChatPin();
  if (!chatPin) {
    if (DEV_MODE) console.warn('[REVIEW DEBUG] sendAutoReviewMessage called but no chat pin');
    return;
  }

  addMessage('user', text);
  saveMessage('user', text);

  const loadingMsg = addMessage('bot', '…');
  isChatRequestInFlight = true;
  setChatControlsDisabled(true);

  try {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Auto /api/ai/chat started');

    await callAIChat(text, { loadingMsg });

    if (DEV_MODE) console.log('[REVIEW DEBUG] Auto /api/ai/chat response received');

  } finally {
    isChatRequestInFlight = false;
    setChatControlsDisabled(false);
  }
}
window.sendAutoReviewMessage = sendAutoReviewMessage;

async function sendMessage() {
  if (isChatRequestInFlight) {
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Ignoring send while request is in flight');
    return;
  }

  const text = chatInput.value.trim();
  if (!text) return;

  const currentUser = getCurrentUser();
  const chatPin = getCurrentChatPin();
  const mode = window.STABIT_CHAT_MODE;

  if (DEV_MODE) {
    console.log('[SEND MESSAGE DEBUG] ===============');
    console.log('[SEND MESSAGE DEBUG] Text:', text);
    console.log('[SEND MESSAGE DEBUG] STABIT_CHAT_MODE:', mode);
    console.log('[SEND MESSAGE DEBUG] activePinId:', currentUser?.activePinId);
    console.log('[SEND MESSAGE DEBUG] reviewingPinId:', currentUser?.reviewingPinId);
    console.log('[SEND MESSAGE DEBUG] Current chat pin:', chatPin?.id);
    console.log('[SEND MESSAGE DEBUG] Pin aiAnalyzed:', chatPin?.aiAnalyzed);
  }

  if (text.toLowerCase() === 'go') {
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Special command: go');
    if (mode === 'pinning') {
      beginPinCeremony();
      return;
    } else {
      addMessage('user', text);
      saveMessage('user', text);
      chatInput.value = '';
      addMessage('bot', '现在我们是在回看这根针，不需要再扎一次啦。');
      return;
    }
  }

  addMessage('user', text);
  saveMessage('user', text);

  chatInput.value = '';

  // Remove previous action buttons when sending a new message in review mode
  if (mode === 'review') {
    const existingButtons = chatLog.querySelectorAll('.chat-action-button, .chat-review-choice-button, .chat-review-choice-wrapper');
    existingButtons.forEach(btn => btn.remove());
  }

  if (mode === 'review' && text.toLowerCase() === 'yes') {
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Special command: yes');
    removeReviewedNeedleWithAnimation();
    return;
  }

  if (mode === 'review' && currentUser) {
    if (currentUser.reviewStage === 'awaiting_user_reason') {
      currentUser.reviewStage = 'followup_response';
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
      if (DEV_MODE) {
        console.log('[SEND MESSAGE DEBUG] reviewStage changed from awaiting_user_reason to followup_response');
      }
    } else if (currentUser.reviewStage === 'initial_review_analysis') {
      currentUser.reviewStage = 'review_conversation';
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
      if (DEV_MODE) {
        console.log('[REVIEW DEBUG] user replied, entering review_conversation');
      }
    }
  }

  const loadingMsg = addMessage('bot', '…');
  isChatRequestInFlight = true;
  setChatControlsDisabled(true);

  try {
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Calling /api/ai/chat first with mode:', mode);

    const chatResponse = await callAIChat(text, { loadingMsg });

    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] /api/ai/chat completed, visible reply shown');

    if (mode === 'pinning') {
      const freshPin = getCurrentChatPin();

      if (DEV_MODE) {
        console.log('[SEND MESSAGE DEBUG] Chat response readyToPin:', chatResponse?.readyToPin);
        console.log('[SEND MESSAGE DEBUG] Chat response has analysis:', !!chatResponse?.analysis);
        console.log('[SEND MESSAGE DEBUG] Pin aiAnalyzed:', freshPin?.aiAnalyzed);
        console.log('[SEND MESSAGE DEBUG] Pin aiAnalyzing:', freshPin?.aiAnalyzing);
      }

      // Analysis metadata is now generated in the single /api/ai/chat call
      // processChatAIResponse() handles saving analysis to pin when present
      if (DEV_MODE && chatResponse?.analysis) {
        console.log('[SEND MESSAGE DEBUG] Analysis received from single /api/ai/chat call - no background analyze-worry needed');
      }
    }
  } finally {
    isChatRequestInFlight = false;
    setChatControlsDisabled(false);
  }
}

async function analyzeWorryWithAI(userText) {
  if (DEV_MODE) console.log('[AI DEBUG] analyzeWorryWithAI called, userText:', userText.substring(0, 50), 'pin:', getCurrentChatPin()?.id);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (DEV_MODE) console.warn('[AI DEBUG] analyze-worry fetch timed out');
      controller.abort();
    }, 30000);

    const response = await fetch('/api/ai/analyze-worry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userText }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const aiResult = await response.json();

    if (DEV_MODE) console.log('[AI DEBUG] analyze-worry result received:', aiResult);

    await processAIResult(aiResult);

  } catch (error) {
    if (DEV_MODE) console.warn('[AI DEBUG] analyze-worry API call failed, using fallback:', error.message || error);

    const fallbackResult = {
      safe: true,
      coreIssue: '这件事还需要被安放',
      reflectionDays: 5,
      warmExplanation: '我先帮你把这件事轻轻收好，等你准备好再回来看看。',
      currentGuides: [
        '先慢慢呼一口气',
        '把这件事写完整',
        '今晚先不用急着解决'
      ]
    };

    await processAIResult(fallbackResult);
  }
}

async function processAIResult(aiResult) {
  const pin = getCurrentChatPin();
  if (!pin) {
    if (DEV_MODE) console.warn('[AI DEBUG] processAIResult called but no current chat pin found');
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    if (DEV_MODE) console.warn('[AI DEBUG] processAIResult called but no currentUser found');
    return;
  }

  const targetPin = currentUser.painPins.find(p => p.id === pin.id);
  if (!targetPin) {
    if (DEV_MODE) console.warn('[AI DEBUG] processAIResult pin not found in currentUser:', pin.id);
    return;
  }

  targetPin.coreIssue = aiResult.coreIssue;
  targetPin.reflectionDays = aiResult.reflectionDays;
  targetPin.warmExplanation = aiResult.warmExplanation;
  targetPin.currentGuides = aiResult.currentGuides;
  targetPin.aiAnalyzedAt = Date.now();
  targetPin.aiResult = aiResult;
  targetPin.reviewReadyAfterDays = aiResult.reflectionDays;
  targetPin.aiAnalyzed = true;
  targetPin.aiAnalyzing = false;

  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);

  if (DEV_MODE) {
    console.log('[AI DEBUG] processAIResult() - pin:', targetPin.id, 'aiAnalyzed:', targetPin.aiAnalyzed, 'coreIssue:', aiResult.coreIssue);
  }
}

const AI_CHAT_TIMEOUT_MS = 180000;

async function callAIChat(userText, options = {}) {
  const pin = getCurrentChatPin();
  const mode = window.STABIT_CHAT_MODE;
  const startTime = Date.now();

  if (DEV_MODE) {
    console.log('[AI CHAT DEBUG] =========================');
    console.log('[AI CHAT DEBUG] Calling AI chat');
    console.log('[AI CHAT DEBUG] Mode:', mode);
    console.log('[AI CHAT DEBUG] Pin ID:', pin?.id);
    console.log('[AI CHAT DEBUG] User text:', userText.substring(0, 50));
    console.log('[AI CHAT DEBUG] Chat history length:', pin?.chatHistory?.length || 0);
    console.log('[AI CHAT DEBUG] AI_CHAT_TIMEOUT_MS:', AI_CHAT_TIMEOUT_MS);
    if (pin?.chatHistory) {
      console.log('[AI CHAT DEBUG] Chat history content:', JSON.stringify(pin.chatHistory.map(m => ({sender: m.sender, text: m.text.substring(0, 30)}))));
    }
  }

  const loadingMsg = options.loadingMsg || addMessage('bot', '…');

  const FALLBACK_STRINGS = [
    '我在听，你可以慢慢说。准备好了，就告诉我。',
    '我还在这里陪你。你可以慢慢看看，这件事现在有没有轻一点。',
    '忧忧想得有点久了，这次没有说完。你可以再发一次，我会继续陪你看这件事。',
    '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。'
  ];

  const rawMessages = pin && pin.chatHistory ? pin.chatHistory.slice(-10) : [];
  const filteredMessages = rawMessages.filter(msg =>
    msg.text !== '…' && !FALLBACK_STRINGS.includes(msg.text)
  );

  if (DEV_MODE) {
    console.log('[AI CHAT DEBUG] Filtered messages - before:', rawMessages.length, 'after:', filteredMessages.length);
  }

  const messages = filteredMessages.map(msg => ({
    role: msg.sender === 'bot' ? 'assistant' : msg.sender,
    content: msg.text
  }));

  if (messages.length === 0) {
    messages.push({ role: 'user', content: userText });
  }

  const currentUser = getCurrentUser();
  const reviewStage = currentUser?.reviewStage;

  const pinInfo = pin ? {
    coreIssue: pin.coreIssue,
    reflectionDays: pin.reflectionDays,
    warmExplanation: pin.warmExplanation,
    currentGuides: pin.currentGuides,
    aiResult: pin.aiResult,
    reviewHistory: pin.reviewHistory,
    reviewCount: pin.reviewCount,
    createdAt: pin.createdAt,
    reviewStage: reviewStage,
    pendingReviewChoice: currentUser?.pendingReviewChoice
  } : null;

  const requestBody = {
    mode,
    messages,
    pin: pinInfo
  };

  if (DEV_MODE) {
    console.log('[AI CHAT DEBUG] =========================');
    console.log('[AI CHAT DEBUG] Full request body:', JSON.stringify(requestBody));
    console.log('[AI CHAT DEBUG] reviewStage sent:', reviewStage);
    console.log('[AI CHAT DEBUG] Latest message:', messages.length > 0 ? messages[messages.length - 1].content.substring(0, 50) : 'none');
    console.log('[AI CHAT DEBUG] Message count:', messages.length);
    console.log('[AI CHAT DEBUG] Messages array:', JSON.stringify(messages.map(m => ({role: m.role, content: m.content.substring(0, 30)}))));
    console.log('[AI CHAT DEBUG] Pin info:', JSON.stringify(pinInfo));
    console.table(messages.map((m, i) => ({index: i, role: m.role, content: m.content.substring(0, 50)})));
  }

  try {
    if (DEV_MODE) console.log('[AI CHAT DEBUG] Fetching:', '/api/ai/chat');
    console.log('[AI CHAT DEBUG] Request body length:', JSON.stringify(requestBody).length);
    console.log('[AI CHAT DEBUG] Timeout:', AI_CHAT_TIMEOUT_MS, 'ms');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (DEV_MODE) console.warn('[AI CHAT DEBUG] Frontend timeout triggered after', AI_CHAT_TIMEOUT_MS, 'ms');
      controller.abort();
    }, AI_CHAT_TIMEOUT_MS);

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (DEV_MODE) {
      console.log('[AI CHAT DEBUG] Response status:', response.status);
      console.log('[AI CHAT DEBUG] Response ok:', response.ok);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 300)}`);
    }

    const responseText = await response.text();
    if (DEV_MODE) {
      console.log('[AI CHAT DEBUG] Response text:', responseText.substring(0, 1000));
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`JSON parse error: ${parseError.message}`);
    }

    if (DEV_MODE) {
      console.log('[AI CHAT DEBUG] AI response parsed:', aiResponse);
      console.log('[AI CHAT DEBUG] Reply:', aiResponse.reply);
      console.log('[AI CHAT DEBUG] Has review:', !!aiResponse.review);
      console.log('[AI CHAT DEBUG] Review nextReflectionDays:', aiResponse.review?.nextReflectionDays);
    }

    if (!aiResponse || typeof aiResponse.reply !== 'string' || !aiResponse.reply.trim()) {
      throw new Error('Invalid AI chat response shape');
    }

    if (aiResponse.debugFallback) {
      if (DEV_MODE) {
        console.warn('[AI CHAT DEBUG] =========================');
        console.warn('[AI CHAT DEBUG] Backend returned fallback response');
        console.warn('[AI CHAT DEBUG] fallback source:', 'backend_debugFallback');
        console.warn('[AI CHAT DEBUG] fallbackReason:', aiResponse.fallbackReason);
        console.warn('[AI CHAT DEBUG] Mode:', mode);
        console.warn('[AI CHAT DEBUG] reviewStage:', reviewStage);
        console.warn('[AI CHAT DEBUG] Elapsed ms:', Date.now() - startTime);
        console.warn('[AI CHAT DEBUG] fallback persisted:', false);
      }

      const fallbackReply = '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。';
      addMessage('bot', fallbackReply);
      return false;
    }

    // Add pipeline tracing
    if (DEV_MODE) {
      console.log('[PIPELINE DEBUG] raw /api/ai/chat response:', JSON.stringify(aiResponse).substring(0, 500));
      console.log('[PIPELINE DEBUG] analysis received:', !!aiResponse.analysis);
    }

    const processedResponse = {
      reply: aiResponse.reply,
      readyToPin: !!aiResponse.readyToPin,
      readyToRemove: !!aiResponse.readyToRemove,
      analysis: aiResponse.analysis,
      review: aiResponse.review,
      reviewDays: aiResponse.reviewDays
    };

    if (DEV_MODE) {
      console.log('[PIPELINE DEBUG] processChatAIResponse analysis:', processedResponse.analysis ? JSON.stringify(processedResponse.analysis).substring(0, 300) : 'undefined');
    }

    processChatAIResponse(processedResponse);
    return processedResponse;

  } catch (error) {
    const elapsedMs = Date.now() - startTime;

    if (DEV_MODE) {
      console.warn('[AI CHAT DEBUG] =========================');
      console.warn('[AI CHAT DEBUG] API call FAILED!');
      console.warn('[AI CHAT DEBUG] Error:', error.message);
      console.warn('[AI CHAT DEBUG] Error name:', error.name);
      console.warn('[AI CHAT DEBUG] Error stack:', error.stack);
      console.warn('[AI CHAT DEBUG] Mode:', mode);
      console.warn('[AI CHAT DEBUG] reviewStage:', reviewStage);
      console.warn('[AI CHAT DEBUG] fallback displayed: true');
      console.warn('[AI CHAT DEBUG] fallback persisted: false');
      console.warn('[AI CHAT DEBUG] fallback reason:', error.message);
      console.warn('[AI CHAT DEBUG] Error type:', typeof error);
      console.warn('[AI CHAT DEBUG] Elapsed ms:', elapsedMs);
      if (error.name === 'AbortError') {
        console.warn('[AI CHAT DEBUG] Request was aborted/timeout');
      }
      if (error.name === 'TypeError') {
        console.warn('[AI CHAT DEBUG] Network error or request issue');
      }
    }

    const fallbackReply = '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。';
    addMessage('bot', fallbackReply);

    if (DEV_MODE) {
      console.warn('[AI CHAT DEBUG] fallback source:', 'frontend_fetch_error');
      console.warn('[AI CHAT DEBUG] fallback persisted:', false);
    }

    return false;
  } finally {
    if (loadingMsg && loadingMsg.parentNode) {
      loadingMsg.parentNode.removeChild(loadingMsg);
      if (DEV_MODE) console.log('[AI CHAT DEBUG] Loading bubble removed');
    }
  }
}

function processChatAIResponse(aiResponse) {
  const mode = window.STABIT_CHAT_MODE;

  if (DEV_MODE) {
    console.log('[AI RESPONSE DEBUG] =========================');
    console.log('[AI RESPONSE DEBUG] Processing AI response');
    console.log('[AI RESPONSE DEBUG] Reply:', aiResponse.reply);
    console.log('[AI RESPONSE DEBUG] readyToPin:', aiResponse.readyToPin);
    console.log('[AI RESPONSE DEBUG] readyToRemove:', aiResponse.readyToRemove);
    console.log('[AI RESPONSE DEBUG] Has analysis:', !!aiResponse.analysis);
    console.log('[AI RESPONSE DEBUG] Mode:', mode);
  }

  addMessage('bot', aiResponse.reply);
  saveMessage('bot', aiResponse.reply);

  // Get currentUser AFTER saveMessage() to avoid stale object issues
  // saveMessage() fetches a fresh user, adds chatHistory, and saves it
  // If we get currentUser before saveMessage(), we'd be modifying a stale object
  // that doesn't include the chatHistory update, and saving it would overwrite
  // the fresh user that saveMessage() just persisted
  const currentUser = getCurrentUser();

  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] current reviewStage after saveMessage:', currentUser?.reviewStage);
  }

  if (aiResponse.analysis) {
    if (DEV_MODE) {
      console.log('[AI RESPONSE DEBUG] chat analysis source: /api/ai/chat');
      console.log('[PIN ANALYSIS DEBUG] metadata received');
    }

    if (currentUser) {
      const chatPin = getCurrentChatPin();

      if (DEV_MODE) {
        console.log('[PIPELINE DEBUG] chatPin id:', chatPin?.id);
        console.log('[PIPELINE DEBUG] activePinId:', window.activePinId);
        console.log('[PIPELINE DEBUG] painPins ids:', currentUser.painPins.map(p => p.id));
      }

      if (!chatPin) {
        if (DEV_MODE) {
          console.warn('[PIPELINE DEBUG] chatPin is null — activePinId:', window.activePinId);
          console.warn('[PIPELINE DEBUG] chatPin is null — currentUser.activePinId:', currentUser.activePinId);
        }
        return;
      }

      if (chatPin) {
        const targetPin = currentUser.painPins.find(p => p.id === chatPin.id);

        if (DEV_MODE) {
          console.log('[PIPELINE DEBUG] targetPin found:', !!targetPin);
        }

        if (targetPin) {
          const wasAnalyzed = targetPin.aiAnalyzed;
          const hadCoreIssue = targetPin.coreIssue && targetPin.coreIssue.trim();

          // Update coreIssue if:
          // 1. The new value is not empty, AND
          // 2. Either the pin doesn't have an existing coreIssue, OR the new value is not a generic placeholder
          const newCoreIssue = aiResponse.analysis.coreIssue?.trim();
          const isPlaceholder = newCoreIssue === '需要整理的情绪' || 
                               newCoreIssue === '这件事还需要被安放' || 
                               newCoreIssue === '这段还未完全放下的烦恼';
          if (newCoreIssue && (!hadCoreIssue || !isPlaceholder)) {
            targetPin.coreIssue = newCoreIssue;
          }

          // Always update reflectionDays if valid
          if (aiResponse.analysis.reflectionDays > 0) {
            targetPin.reflectionDays = aiResponse.analysis.reflectionDays;
          }

          targetPin.warmExplanation = aiResponse.analysis.warmExplanation;
          targetPin.currentGuides = aiResponse.analysis.currentGuides;
          targetPin.aiResult = aiResponse.analysis;
          targetPin.aiAnalyzedAt = Date.now();
          targetPin.reviewReadyAfterDays = aiResponse.analysis.reflectionDays;
          targetPin.aiAnalyzed = true;
          targetPin.aiAnalyzing = false;

          if (DEV_MODE) {
            console.log('[PIN ANALYSIS DEBUG] coreIssue saved:', aiResponse.analysis.coreIssue);
            console.log('[PIN ANALYSIS DEBUG] reflectionDays saved:', aiResponse.analysis.reflectionDays);
            if (wasAnalyzed && aiResponse.analysis.coreIssue !== targetPin.coreIssue) {
              console.log('[PIN ANALYSIS DEBUG] analysis refined');
            }
          }

          UserStorage.updateUser(currentUser);
          UserStorage.setCurrentUser(currentUser.username);

          // Reload storage and verify the fields exist
          if (DEV_MODE) {
            const reloadedUser = UserStorage.getCurrentUser();
            const reloadedPin = reloadedUser?.painPins.find(p => p.id === targetPin.id);
            console.log('[PIPELINE DEBUG] stored pin after metadata save:', {
              id: reloadedPin?.id,
              coreIssue: reloadedPin?.coreIssue,
              reflectionDays: reloadedPin?.reflectionDays,
              aiAnalyzed: reloadedPin?.aiAnalyzed,
              aiResult: reloadedPin?.aiResult ? JSON.stringify(reloadedPin?.aiResult).substring(0, 200) : undefined
            });
          }
        }
      }
    }
  }

  if (mode === 'pinning') {
    if (DEV_MODE) {
      console.log('[AI RESPONSE DEBUG] showing "交给忧忧" button (always visible in pinning mode)');
      console.log('[PIN ANALYSIS DEBUG] no secondary analyze-worry request');
    }

    if (currentUser) {
      currentUser.pendingAction = 'pin';
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }

    setTimeout(() => {
      addActionButton('交给忧忧', () => {
        if (currentUser) {
          currentUser.pendingAction = null;
          UserStorage.updateUser(currentUser);
          UserStorage.setCurrentUser(currentUser.username);
        }
        beginPinCeremony();
      });
    }, 300);
  }

  if (mode === 'review' && currentUser) {
    // Advance review stage after initial analysis response
    const wasInitialDiagnostic = currentUser.reviewStage === 'initial_review_analysis';
    if (wasInitialDiagnostic) {
      currentUser.reviewStage = 'review_conversation';
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
      if (DEV_MODE) console.log('[REVIEW DEBUG] first diagnostic: suppressing buttons, advancing to review_conversation');
    }

    if (DEV_MODE) console.log('[REVIEW ACTIONS DEBUG] initial diagnostic complete:', !wasInitialDiagnostic);

    // Buttons should only show after the initial diagnostic (first user reply + AI response)
    if (!wasInitialDiagnostic) {
      // Show review choice buttons after initial diagnostic is complete
      const pin = getCurrentChatPin();

      // Check if pin is still active
      const isPinActive = pin && currentUser.painPins.find(p => p.id === pin.id);
      if (!isPinActive) {
        if (DEV_MODE) console.log('[REVIEW ACTIONS DEBUG] actions skipped: pin no longer active');
        return;
      }

      // Priority order: reviewDays (top-level) > review.nextReflectionDays > pin.reflectionDays
      // reviewDays allows the AI to dynamically control the exact number of days
      const reviewDays = aiResponse.reviewDays;
      const apiDays = aiResponse.review?.nextReflectionDays;

      // Validate reviewDays: must be a finite positive whole number
      const isValidReviewDays = reviewDays !== null &&
                                reviewDays !== undefined &&
                                Number.isFinite(reviewDays) &&
                                reviewDays > 0 &&
                                Math.floor(reviewDays) === reviewDays;

      // Determine the final days value
      let nextReflectionDays;
      if (isValidReviewDays) {
        nextReflectionDays = reviewDays;
        // Update pin.reflectionDays with the new value
        pin.reflectionDays = reviewDays;
        UserStorage.updateUser(currentUser);
        UserStorage.setCurrentUser(currentUser.username);
        if (DEV_MODE) {
          console.log('[REVIEW DAYS DEBUG] AI reviewDays received:', reviewDays);
          console.log('[REVIEW DAYS DEBUG] pin reflectionDays updated:', reviewDays);
        }
      } else {
        // Fall back to existing sources
        nextReflectionDays = apiDays ?? pin?.reflectionDays ?? 5;
        if (reviewDays !== null && reviewDays !== undefined && !isValidReviewDays) {
          if (DEV_MODE) console.log('[REVIEW DAYS DEBUG] invalid reviewDays ignored:', reviewDays);
        }
        if (!isValidReviewDays && reviewDays === null) {
          if (DEV_MODE) console.log('[REVIEW DAYS DEBUG] previous value retained:', nextReflectionDays);
        }
      }

      const reviewData = aiResponse.review || {};

      if (DEV_MODE) {
        console.log('[AI RESPONSE DEBUG] =========================');
        console.log('[AI RESPONSE DEBUG] API reviewDays:', reviewDays, '(valid:', isValidReviewDays, ')');
        console.log('[AI RESPONSE DEBUG] API nextReflectionDays:', apiDays);
        console.log('[AI RESPONSE DEBUG] final nextReflectionDays:', nextReflectionDays, '(source:', isValidReviewDays ? 'reviewDays' : apiDays !== null && apiDays !== undefined ? 'api' : pin?.reflectionDays ? 'pin' : 'default', ')');
        console.log('[AI RESPONSE DEBUG] reviewStage:', currentUser.reviewStage);
      }

      // Always show review action buttons - nextReflectionDays already has fallback value from pin.reflectionDays or default 5

      if (DEV_MODE) {
        console.log('[REVIEW DEBUG] showing review choice buttons: 继续聊 +', nextReflectionDays, '天后看 + 取下针');
        console.log('[REVIEW DAYS DEBUG] action label rendered:', nextReflectionDays, '天后看');
      }

      if (DEV_MODE) console.log('[REVIEW ACTIONS DEBUG] removing previous action row');

      currentUser.pendingAction = 'review_reschedule';
      currentUser.pendingReviewAction = {
        pinId: window.reviewingPinId || currentUser.reviewingPinId,
        nextReflectionDays: nextReflectionDays,
        reasonCategory: reviewData.reasonCategory,
        stillAffectsUser: reviewData.stillAffectsUser
      };
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);

      setTimeout(() => {
        if (DEV_MODE) console.log('[REVIEW ACTIONS DEBUG] rendering actions after assistant reply');
        addReviewChoiceButtons(nextReflectionDays, reviewData);
      }, 300);
    } else {
      if (DEV_MODE) console.log('[REVIEW ACTIONS DEBUG] actions skipped: initial diagnostic');
    }
  }
}

function removeReviewedNeedleWithAnimation() {
  hidePersistentUnpinButton();

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) {
    if (DEV_MODE) console.log('[PIN DEBUG] No user or painPins found');
    return;
  }

  currentUser.resolvedPins = currentUser.resolvedPins || [];

  const painPinsCountBefore = currentUser.painPins.length;
  const resolvedPinsCountBefore = currentUser.resolvedPins.length;

  let pinToRemove = null;
  let pinIndex = -1;

  if (window.reviewingPinId || currentUser.reviewingPinId) {
    const reviewingId = window.reviewingPinId || currentUser.reviewingPinId;
    pinIndex = currentUser.painPins.findIndex(p => p.id === reviewingId);
    if (pinIndex !== -1) {
      pinToRemove = currentUser.painPins[pinIndex];
    } else {
      if (DEV_MODE) {
        console.error('[REVIEW LOOP DEBUG] chat remove - reviewingPinId not found in painPins:', reviewingId);
      }
    }
  }

  if (!pinToRemove) {
    if (DEV_MODE) {
      console.error('[REVIEW LOOP DEBUG] chat remove - no reviewingPinId set, aborting to avoid wrong pin removal');
    }
    addMessage('bot', '没有找到正在回顾的针。');
    return;
  }

  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] =========================');
    console.log('[REVIEW LOOP DEBUG] chat remove clicked');
    console.log('[REVIEW LOOP DEBUG] reviewed pin id:', pinToRemove.id);
    console.log('[REVIEW LOOP DEBUG] activePinId:', currentUser.activePinId);
    console.log('[REVIEW LOOP DEBUG] reviewingPinId:', currentUser.reviewingPinId);
    console.log('[REVIEW LOOP DEBUG] painPins count before:', painPinsCountBefore);
    console.log('[REVIEW LOOP DEBUG] resolvedPins count before:', resolvedPinsCountBefore);
  }

  const chatPanel = chatScreen.querySelector('.chat-panel');
  const pinElement = chatScreen.querySelector(`.pin-stuck[data-pin-id="${pinToRemove.id}"]`);

  if (DEV_MODE) {
    console.log('[PIN DEBUG] removeReviewedNeedleWithAnimation() - pin:', pinToRemove.id, 'DOM element found:', !!pinElement);
  }

  if (chatPanel) {
    chatPanel.classList.add('review-chat-fade-out');
  }

  const archiveAndRemovePin = (user) => {
    if (!user || !user.painPins) return;

    user.resolvedPins = user.resolvedPins || [];

    const resolvedPin = {
      id: pinToRemove.id,
      x: pinToRemove.x,
      y: pinToRemove.y,
      createdAt: pinToRemove.createdAt,
      completed: pinToRemove.completed,
      hasNeedle: false,
      chatHistory: pinToRemove.chatHistory || [],
      coreIssue: pinToRemove.coreIssue,
      reflectionDays: pinToRemove.reflectionDays,
      warmExplanation: pinToRemove.warmExplanation,
      currentGuides: pinToRemove.currentGuides,
      aiResult: pinToRemove.aiResult,
      aiAnalyzed: pinToRemove.aiAnalyzed,
      resolvedAt: Date.now(),
      removedAt: Date.now(),
      status: 'resolved'
    };

    user.resolvedPins.push(resolvedPin);

    const freshIndex = user.painPins.findIndex(p => p.id === pinToRemove.id);
    if (freshIndex !== -1) {
      user.painPins.splice(freshIndex, 1);
    }

    const oldActivePinId = user.activePinId;
    if (user.activePinId === pinToRemove.id) {
      user.activePinId = null;
    }

    user.reviewingPinId = null;
    UserStorage.updateUser(user);
    UserStorage.setCurrentUser(user.username);

    if (DEV_MODE) {
      console.log('[PIN DEBUG] Pin archived to resolvedPins:', pinToRemove.id);
      console.log('[PIN DEBUG] old activePinId:', oldActivePinId);
      console.log('[PIN DEBUG] new activePinId:', user.activePinId);
      console.log('[PIN DEBUG] reviewingPinId cleared:', user.reviewingPinId);
      console.log('[PIN DEBUG] resolvedPins count:', user.resolvedPins.length);
      console.log('[PIN DEBUG] remaining painPins count:', user.painPins.length);
      console.log('[PIN DEBUG] remaining painPins ids:', user.painPins.map(p => p.id));
      console.log('[PIN DEBUG] resolvedPins ids:', user.resolvedPins.map(p => p.id));
      console.log('[REVIEW LOOP DEBUG] painPins count after:', user.painPins.length);
      console.log('[REVIEW LOOP DEBUG] resolvedPins count after:', user.resolvedPins.length);
    }
  };

  setTimeout(() => {
    if (pinElement) {
      const ripple = document.createElement('div');
      ripple.className = 'needle-release-ripple';
      ripple.style.left = pinElement.style.left;
      ripple.style.top = pinElement.style.top;
      chatScreen.appendChild(ripple);

      setTimeout(() => {
        ripple.classList.add('impact');
      }, 50);

      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 750);

      pinElement.classList.add('needle-fade-away');

      setTimeout(() => {
        if (pinElement.parentNode) {
          pinElement.parentNode.removeChild(pinElement);
        }

        const freshUser = getCurrentUser();
        archiveAndRemovePin(freshUser);

        window.STABIT_CHAT_MODE = 'pinning';
        window.reviewingPinId = null;

        if (chatPanel) {
          chatPanel.remove();
        }

        showHomeScreen();
          if (DEV_MODE) console.log('[REVIEW LOOP DEBUG] returned home true');
          setTimeout(() => {
            if (window.showReleaseConfettiOverlay) {
              window.showReleaseConfettiOverlay();
            }
            if (window.showReleaseCelebrationText) {
              window.showReleaseCelebrationText();
            }
          }, 300);
      }, 1250);
    } else {
      if (DEV_MODE) console.log('[PIN DEBUG] Matching DOM element not found, removing from storage only');

      const freshUser = getCurrentUser();
      archiveAndRemovePin(freshUser);

      if (window.loadSavedNeedlesToChat) {
        window.loadSavedNeedlesToChat();
      }

      window.STABIT_CHAT_MODE = 'pinning';
      window.reviewingPinId = null;

      if (chatPanel) {
        chatPanel.remove();
      }

      showReleaseCelebrationButton(() => {
        showHomeScreen();
        if (DEV_MODE) console.log('[REVIEW LOOP DEBUG] returned home true');
        setTimeout(() => {
          if (window.showReleaseConfettiOverlay) {
            window.showReleaseConfettiOverlay();
          }
          if (window.showReleaseCelebrationText) {
            window.showReleaseCelebrationText();
          }
        }, 300);
      });
    }
  }, 450);
}

function showPostRemovalScreen(currentUser) {
  const remainingCompleted = currentUser.painPins.filter(p => p.completed || p.hasNeedle);

  if (remainingCompleted.length > 0) {
    const nextPin = remainingCompleted[0];
    const fastForwardDays = nextPin?.reflectionDays || DEMO_FAST_FORWARD_DAYS;

    const demoMessage = document.createElement('div');
    demoMessage.className = 'summary-line';
    demoMessage.textContent = `为了演示回顾功能，快进到 ${fastForwardDays} 天后，看看你是否已经准备好放下这针烦恼。`;
    demoMessage.style.fontSize = '18px';
    demoMessage.style.opacity = '0.9';

    const fastForwardBtn = document.createElement('button');
    fastForwardBtn.className = 'summary-btn';
    fastForwardBtn.textContent = `快进 ${fastForwardDays} 天`;

    fastForwardBtn.addEventListener('click', () => {
      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] =========================');
        console.log('[FAST FORWARD DEBUG] button clicked (post-removal)');
        console.log('[FAST FORWARD DEBUG] selected pin id:', nextPin?.id);
        console.log('[FAST FORWARD DEBUG] selected reflectionDays:', fastForwardDays);
      }

      fastForwardCompanionDays(fastForwardDays);

      window.STABIT_MODE = 'reviewNeedle';
      window.STABIT_CHAT_MODE = null;

      const existingBadge = chatScreen.querySelector('.day-badge');
      if (existingBadge) {
        existingBadge.textContent = '💗 陪伴第 ' + getCompanionDays() + ' 天';
      }

      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] opening review panel directly');
      }

      setTimeout(() => {
        if (window.showReviewPanel) {
          window.showReviewPanel();
          if (DEV_MODE) console.log('[FAST FORWARD DEBUG] showReviewPanel called: true');
        } else {
          if (DEV_MODE) console.error('[FAST FORWARD DEBUG] ERROR: showReviewPanel is not available');
        }
      }, 100);
    });

    const demoContainer = document.createElement('div');
    demoContainer.className = 'summary-panel';
    demoContainer.style.display = 'flex';
    demoContainer.style.flexDirection = 'column';
    demoContainer.style.alignItems = 'center';
    demoContainer.style.gap = '20px';

    demoContainer.appendChild(demoMessage);
    demoContainer.appendChild(fastForwardBtn);
    chatScreen.appendChild(demoContainer);

    setTimeout(() => {
      demoContainer.classList.add('show');
    }, 50);
  } else {
    const finalMessage = document.createElement('div');
    finalMessage.className = 'summary-panel';
    finalMessage.style.display = 'flex';
    finalMessage.style.flexDirection = 'column';
    finalMessage.style.alignItems = 'center';
    finalMessage.style.justifyContent = 'center';

    const messageEl = document.createElement('div');
    messageEl.className = 'summary-line primary';
    messageEl.textContent = '今天的针已经都放下了，忧忧会继续陪着你。';
    messageEl.style.fontSize = '18px';

    finalMessage.appendChild(messageEl);
    chatScreen.appendChild(finalMessage);

    setTimeout(() => {
      finalMessage.classList.add('show');
    }, 50);
  }
}

function addMessage(sender, text) {
  if (sender === 'system') {
    const separatorEl = document.createElement('div');
    separatorEl.className = 'chat-separator';
    separatorEl.textContent = text;
    chatLog.appendChild(separatorEl);
    scrollToBottom();
    return separatorEl;
  }

  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = `chat-avatar ${sender}`;
  avatar.textContent = sender === 'user' ? '用' : '忧';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;

  messageEl.appendChild(avatar);
  messageEl.appendChild(bubble);

  chatLog.appendChild(messageEl);

  scrollToBottom();

  return messageEl;
}
window.addMessage = addMessage;

function addActionButton(label, onClick) {
  const existingButtons = chatLog.querySelectorAll('.chat-action-button');
  existingButtons.forEach(btn => btn.remove());

  const buttonEl = document.createElement('button');
  buttonEl.className = 'chat-action-button';
  buttonEl.textContent = label;
  buttonEl.addEventListener('click', onClick);

  const wrapper = document.createElement('div');
  wrapper.className = 'chat-action-wrapper';
  wrapper.appendChild(buttonEl);

  chatLog.appendChild(wrapper);
  scrollToBottom();

  if (DEV_MODE) console.log('[CHAT DEBUG] addActionButton() - label:', label);

  return buttonEl;
}
window.addActionButton = addActionButton;

function addReviewChoiceButtons(nextReflectionDays, reviewData) {
  const existingButtons = chatLog.querySelectorAll('.chat-action-button, .chat-review-choice-button');
  existingButtons.forEach(btn => btn.remove());

  hidePersistentUnpinButton();

  if (DEV_MODE) {
    console.log('[CHAT DEBUG] addReviewChoiceButtons() - nextReflectionDays:', nextReflectionDays);
    console.log('[CHAT DEBUG] addReviewChoiceButtons() - reviewData:', reviewData);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'chat-review-choice-wrapper three-actions';

  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] removed floating persistent unpin button');
    console.log('[REVIEW DEBUG] showing three review actions: continue +', nextReflectionDays, '+ unpin');
  }

  const continueBtn = document.createElement('button');
  continueBtn.className = 'chat-review-choice-button';
  continueBtn.textContent = '继续聊';
  continueBtn.addEventListener('click', () => {
    if (DEV_MODE) {
      console.log('[CHAT DEBUG] "继续聊" clicked');
      console.log('[REVIEW DEBUG] continue chatting selected');
    }
    const existingButtons = chatLog.querySelectorAll('.chat-review-choice-button');
    existingButtons.forEach(btn => btn.remove());

    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.pendingAction = null;
      currentUser.pendingReviewAction = null;
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }
  });

  const rescheduleBtn = document.createElement('button');
  rescheduleBtn.className = 'chat-review-choice-button';
  rescheduleBtn.textContent = `${nextReflectionDays}天后看`;
  rescheduleBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] reschedule selected:', nextReflectionDays, 'days');
    rescheduleReview(nextReflectionDays, reviewData);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'chat-review-choice-button release';
  removeBtn.textContent = '我想取下针';
  removeBtn.addEventListener('click', () => {
    if (DEV_MODE) {
      console.log('[CHAT DEBUG] "取下针" clicked');
      console.log('[REVIEW DEBUG] inline unpin clicked');
    }
    removeReviewedNeedleWithAnimation();
  });

  wrapper.appendChild(continueBtn);
  wrapper.appendChild(rescheduleBtn);
  wrapper.appendChild(removeBtn);

  chatLog.appendChild(wrapper);
  scrollToBottom();

  if (DEV_MODE) console.log('[CHAT DEBUG] styled review action buttons rendered with three options');
}
window.addReviewChoiceButtons = addReviewChoiceButtons;
window.analyzeWorryWithAI = analyzeWorryWithAI;

function rescheduleReview(nextReflectionDays, reviewData) {
  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] =========================');
    console.log('[REVIEW LOOP DEBUG] reschedule clicked');
    console.log('[REVIEW DEBUG] reschedule selected:', nextReflectionDays, 'days');
    console.log('[REVIEW DAYS DEBUG] pin rescheduled by exactly', nextReflectionDays, 'days');
  }

  hidePersistentUnpinButton();

  const currentUser = getCurrentUser();
  if (!currentUser) {
    if (DEV_MODE) console.error('[REVIEW LOOP DEBUG] reschedule - no currentUser');
    return;
  }

  const pinId = window.reviewingPinId || currentUser.reviewingPinId;
  if (!pinId) {
    if (DEV_MODE) console.error('[REVIEW LOOP DEBUG] reschedule - no reviewingPinId, aborting');
    return;
  }

  const pin = currentUser.painPins.find(p => p.id === pinId);
  if (!pin) {
    if (DEV_MODE) {
      console.error('[REVIEW LOOP DEBUG] reschedule - pin not found in painPins:', pinId);
      console.error('[REVIEW LOOP DEBUG] reschedule - not mutating any other pin');
    }
    return;
  }

  const validDays = (typeof nextReflectionDays === 'number' && nextReflectionDays > 0) ? nextReflectionDays : 5;

  const currentDay = getCurrentCompanionDay();
  const newReviewDay = currentDay + validDays;

  const painPinsCountBefore = currentUser.painPins.length;
  const resolvedPinsCountBefore = (currentUser.resolvedPins || []).length;
  const oldReviewDay = pin.reviewDay;
  const oldReviewCount = pin.reviewCount || 0;

  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] reviewed pin id:', pinId);
    console.log('[REVIEW LOOP DEBUG] activePinId:', currentUser.activePinId);
    console.log('[REVIEW LOOP DEBUG] reviewingPinId:', currentUser.reviewingPinId);
    console.log('[REVIEW LOOP DEBUG] requested days:', nextReflectionDays, '-> valid days:', validDays);
    console.log('[REVIEW LOOP DEBUG] painPins count before:', painPinsCountBefore);
    console.log('[REVIEW LOOP DEBUG] resolvedPins count before:', resolvedPinsCountBefore);
    console.log('[REVIEW LOOP DEBUG] reviewDay before:', oldReviewDay);
    console.log('[REVIEW LOOP DEBUG] reviewCount before:', oldReviewCount);
  }

  pin.lastReviewedAt = Date.now();
  pin.lastReviewedDay = currentDay;
  pin.reviewCount = oldReviewCount + 1;
  pin.reflectionDays = validDays;
  pin.reviewDay = newReviewDay;
  pin.latestReview = reviewData;

  pin.reviewHistory = pin.reviewHistory || [];
  pin.reviewHistory.push({
    reviewedAt: Date.now(),
    reviewedDay: currentDay,
    nextReflectionDays: validDays,
    reasonCategory: reviewData.reasonCategory,
    stillAffectsUser: reviewData.stillAffectsUser,
    aiReply: reviewData.aiReply || ''
  });

  if (currentUser.activePinId === pinId) {
    const stillExists = currentUser.painPins.some(p => p.id === pinId);
    if (!stillExists) {
      currentUser.activePinId = null;
    }
  }

  currentUser.reviewingPinId = null;
  currentUser.pendingAction = null;
  currentUser.pendingReviewAction = null;
  currentUser.reviewStage = null;
  window.reviewingPinId = null;
  window.STABIT_CHAT_MODE = null;

  currentUser.showReviewShortcut = true;

  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);

  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] reviewDay after:', pin.reviewDay);
    console.log('[REVIEW LOOP DEBUG] reviewCount after:', pin.reviewCount);
    console.log('[REVIEW LOOP DEBUG] painPins count after:', currentUser.painPins.length);
    console.log('[REVIEW LOOP DEBUG] resolvedPins count after:', (currentUser.resolvedPins || []).length);
    console.log('[REVIEW SHORTCUT DEBUG] enabled after reschedule');
  }

  showHomeScreen();
  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] returned home true');
  }
}

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function getActivePin() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.activePinId || !currentUser.painPins) return null;
  return currentUser.painPins.find(p => p.id === currentUser.activePinId);
}

function getReviewingPin() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.reviewingPinId || !currentUser.painPins) return null;
  return currentUser.painPins.find(p => p.id === currentUser.reviewingPinId);
}

function getCurrentChatPin() {
  if (window.STABIT_CHAT_MODE === 'review') {
    return getReviewingPin();
  }
  return getActivePin();
}

function saveMessageToPin(pin, sender, text) {
  if (!pin) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const pinId = pin.id;
  const targetPin = currentUser.painPins.find(p => p.id === pinId);

  if (!targetPin) {
    if (DEV_MODE) console.warn('[CHAT DEBUG] saveMessageToPin() - pin not found in currentUser:', pinId);
    return;
  }

  if (!targetPin.chatHistory) {
    targetPin.chatHistory = [];
  }

  targetPin.chatHistory.push({
    sender,
    text,
    createdAt: Date.now()
  });

  const mode = window.STABIT_CHAT_MODE;
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] saveMessageToPin() - mode:', mode, 'pin:', pinId, 'sender:', sender, 'chatHistory length:', targetPin.chatHistory.length);
  }

  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);
}

function saveMessage(sender, text) {
  const pin = getCurrentChatPin();
  saveMessageToPin(pin, sender, text);
}

function loadPinChatHistory(pin) {
  if (!pin) {
    if (DEV_MODE) console.log('[CHAT LOAD DEBUG] loadPinChatHistory: no pin provided');
    addMessage('bot', GREETING_MESSAGE);
    saveMessage('bot', GREETING_MESSAGE);
    return;
  }

  if (!pin.chatHistory || pin.chatHistory.length === 0) {
    if (DEV_MODE) console.log('[CHAT LOAD DEBUG] loadPinChatHistory: empty chatHistory, adding greeting');
    addMessage('bot', GREETING_MESSAGE);
    saveMessageToPin(pin, 'bot', GREETING_MESSAGE);
    return;
  }

  if (DEV_MODE) {
    console.log('[CHAT LOAD DEBUG] loadPinChatHistory: chatHistory exists, length:', pin.chatHistory.length);
    console.log('[CHAT LOAD DEBUG] loadPinChatHistory: skipping greeting - existing chat found');
  }

  const visibleMessages = pin.chatHistory.filter(msg => {
    return !(msg.sender === 'bot' && isEphemeralBotMessage(msg.text));
  });

  if (visibleMessages.length === 0) {
    if (DEV_MODE) console.log('[CHAT LOAD DEBUG] loadPinChatHistory: all messages filtered out, adding greeting');
    addMessage('bot', GREETING_MESSAGE);
    saveMessageToPin(pin, 'bot', GREETING_MESSAGE);
    return;
  }

  if (DEV_MODE) console.log('[CHAT LOAD DEBUG] loadPinChatHistory: rendering', visibleMessages.length, 'visible messages');
  visibleMessages.forEach(msg => {
    addMessage(msg.sender, msg.text);
  });
}

function loadChatHistory() {
  const pin = getCurrentChatPin();

  if (DEV_MODE) {
    console.log('[CHAT LOAD DEBUG] loadChatHistory called');
    console.log('[CHAT LOAD DEBUG] Current chat pin:', pin?.id);
    console.log('[CHAT LOAD DEBUG] Chat history length:', pin?.chatHistory?.length || 0);
    console.log('[CHAT LOAD DEBUG] STABIT_CHAT_MODE:', window.STABIT_CHAT_MODE);
  }

  if (!pin) {
    if (DEV_MODE) console.log('[CHAT LOAD DEBUG] No pin found, showing greeting');
    addMessage('bot', GREETING_MESSAGE);
    saveMessage('bot', GREETING_MESSAGE);
    return;
  }

  loadPinChatHistory(pin);
}

function beginPinCeremony() {
  chatInput.value = '';
  chatInput.disabled = true;

  const currentUser = getCurrentUser();

  if (currentUser && currentUser.painPins && currentUser.painPins.length > 0) {
    const latestPin = currentUser.painPins[currentUser.painPins.length - 1];

    latestPin.isAnimating = true;

    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);

    if (DEV_MODE) {
      console.log('[PIN DEBUG] beginPinCeremony() - pin:', latestPin.id, 'chatHistory length:', latestPin.chatHistory?.length || 0);
    }
  }

  fadeOutChat();

  setTimeout(() => {
    animatePin();
  }, 700);
}

function fadeOutChat() {
  chatLog.classList.add('ceremony-fade');
  chatPanel.querySelector('.chat-input-area').classList.add('ceremony-slide');
}

function animatePin() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins || currentUser.painPins.length === 0) {
    showSummaryPanel();
    return;
  }

  const latestPin = currentUser.painPins[currentUser.painPins.length - 1];
  const pinId = latestPin.id;
  const chatPoint = mapNormalizedPointToZone(latestPin, CHAT_BODY_ZONE);

  const projectile = document.createElement('img');
  projectile.className = 'ceremony-projectile';
  projectile.src = '/assets/pin/pin-flying.png';

  projectile.style.opacity = '0';
  projectile.style.left = '115%';
  projectile.style.top = chatPoint.percentY + '%';
  projectile.style.width = PIN_FLYING_SIZE;
  projectile.style.transform = `translate(-50%, -50%) scale(1.7) rotate(${PIN_FLYING_ROTATION})`;

  chatScreen.appendChild(projectile);

  setTimeout(() => {
  projectile.style.opacity = '1';
  projectile.classList.add('animating');

  projectile.style.left = chatPoint.percentX + '%';
  projectile.style.top = chatPoint.percentY + '%';
  projectile.style.transform = `translate(-50%, -50%) scale(1) rotate(${PIN_STUCK_ROTATION})`;
}, 50);

  setTimeout(() => {
    projectile.remove();

    const existingPainDot = chatScreen.querySelector('.pain-dot');
    if (existingPainDot) {
      existingPainDot.remove();
    }

    const pinStuck = document.createElement('img');
    pinStuck.className = 'pin-stuck landing';
    pinStuck.src = '/assets/pin/pin-stuck.png';
    pinStuck.dataset.pinId = pinId;
    pinStuck.style.left = chatPoint.percentX+PIN_STUCK_OFFSET_X + '%';
    pinStuck.style.top = (chatPoint.percentY+PIN_STUCK_OFFSET_Y) + '%';
    pinStuck.style.width = PIN_STUCK_SIZE;
    chatScreen.appendChild(pinStuck);

    const glow = document.createElement('div');
    glow.className = 'ceremony-glow impact';
    glow.style.left = chatPoint.percentX + '%';
    glow.style.top = (chatPoint.percentY) + '%';
    chatScreen.appendChild(glow);

    const freshUser = getCurrentUser();
    if (freshUser && freshUser.painPins) {
      const targetPin = freshUser.painPins.find(p => p.id === pinId);
      if (targetPin) {
        targetPin.completed = true;
        targetPin.hasNeedle = true;
        targetPin.isAnimating = false;

        if (DEV_MODE) {
          console.log('[PIN DEBUG] animatePin() - pin:', targetPin.id, 'completed:', targetPin.completed, 'hasNeedle:', targetPin.hasNeedle, 'chatHistory length:', targetPin.chatHistory?.length || 0);
        }

        UserStorage.updateUser(freshUser);
        UserStorage.setCurrentUser(freshUser.username);
      }
    }

    playPinImpactSound();

    setTimeout(() => {
      showSummaryPanel();
    }, 300);
  }, 850);
}

function showSummaryPanel() {
  const existingPanel = chatScreen.querySelector('.summary-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const currentUser = getCurrentUser();
  const pinCount = currentUser?.painPins?.length || 0;

  const summaryPanel = document.createElement('div');
  summaryPanel.className = 'summary-panel';

  const primaryEl = document.createElement('div');
  primaryEl.className = 'summary-line primary';
  primaryEl.textContent = SUMMARY_BLOCKS.primary;

  const countEl = document.createElement('div');
  countEl.className = 'summary-line count';
  countEl.textContent = `目前承载着 ${pinCount} 根针。`;

  const secondaryEl = document.createElement('div');
  secondaryEl.className = 'summary-line secondary';
  secondaryEl.textContent = SUMMARY_BLOCKS.secondary;

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'summary-buttons';

  const leftBtn = document.createElement('button');
  leftBtn.className = 'summary-btn';
  leftBtn.textContent = '再扎下一针';
  leftBtn.addEventListener('click', () => {
    showHomeScreen();
  });

  const rightBtn = document.createElement('button');
  rightBtn.className = 'summary-btn';
  rightBtn.textContent = '今天先到这里';
  rightBtn.addEventListener('click', () => {
    primaryEl.remove();
    countEl.remove();
    secondaryEl.remove();
    buttonsContainer.remove();

    const chatPin = getCurrentChatPin();
    const reviewDays = chatPin?.reflectionDays || DEMO_FAST_FORWARD_DAYS;

    const demoMessage = document.createElement('div');
    demoMessage.className = 'summary-line';
    demoMessage.textContent = `为了演示回顾功能，快进到 ${reviewDays} 天后，看看你是否已经准备好放下这针烦恼。`;
    demoMessage.style.fontSize = '18px';
    demoMessage.style.opacity = '0.9';
    demoMessage.style.marginTop = '10px';

    const fastForwardBtn = document.createElement('button');
    fastForwardBtn.className = 'summary-btn';
    fastForwardBtn.textContent = `快进 ${reviewDays} 天`;
    fastForwardBtn.style.marginTop = '5px';

    fastForwardBtn.addEventListener('click', () => {
      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] =========================');
        console.log('[FAST FORWARD DEBUG] button clicked');
        console.log('[FAST FORWARD DEBUG] selected pin id:', chatPin?.id);
        console.log('[FAST FORWARD DEBUG] selected reflectionDays:', reviewDays);
      }

      if (!chatPin) {
        if (DEV_MODE) console.error('[FAST FORWARD DEBUG] ERROR: No chat pin found');
        return;
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        if (DEV_MODE) console.error('[FAST FORWARD DEBUG] ERROR: No current user');
        return;
      }

      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] companionDayOffset before:', currentUser.companionDayOffset || 0);
        console.log('[FAST FORWARD DEBUG] STABIT_MODE before:', window.STABIT_MODE);
      }

      fastForwardCompanionDays(reviewDays);

      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] companionDayOffset after:', currentUser.companionDayOffset || 0);
      }

      window.STABIT_MODE = 'reviewNeedle';
      window.STABIT_CHAT_MODE = null;

      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] STABIT_MODE after:', window.STABIT_MODE);
        console.log('[FAST FORWARD DEBUG] STABIT_CHAT_MODE after:', window.STABIT_CHAT_MODE);
      }

      const existingBadge = chatScreen.querySelector('.day-badge');
      if (existingBadge) {
        existingBadge.textContent = '💗 陪伴第 ' + getCompanionDays() + ' 天';
      }

      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] opening review panel directly');
        console.log('[FAST FORWARD DEBUG] selected pin id:', chatPin.id);
        console.log('[FAST FORWARD DEBUG] selected reflectionDays:', reviewDays);
      }

      setTimeout(() => {
        if (window.showReviewPanel) {
          window.showReviewPanel(chatPin.id);
          if (DEV_MODE) console.log('[FAST FORWARD DEBUG] showReviewPanel called with pinId:', chatPin.id);
        } else {
          if (DEV_MODE) console.error('[FAST FORWARD DEBUG] ERROR: showReviewPanel is not available');
        }
      }, 100);
    });

    const demoContainer = document.createElement('div');
    demoContainer.style.display = 'flex';
    demoContainer.style.flexDirection = 'column';
    demoContainer.style.alignItems = 'center';
    demoContainer.style.gap = '20px';
    demoContainer.style.marginTop = '10px';

    demoContainer.appendChild(demoMessage);
    demoContainer.appendChild(fastForwardBtn);
    summaryPanel.appendChild(demoContainer);
  });

  buttonsContainer.appendChild(leftBtn);
  buttonsContainer.appendChild(rightBtn);

  summaryPanel.appendChild(primaryEl);
  summaryPanel.appendChild(countEl);
  summaryPanel.appendChild(secondaryEl);
  summaryPanel.appendChild(buttonsContainer);
  chatScreen.appendChild(summaryPanel);

  setTimeout(() => {
    summaryPanel.classList.add('show');
  }, 50);
}
