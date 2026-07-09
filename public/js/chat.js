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
      45% {
        opacity: 1;
        transform: translateY(2%) translateX(1px) scale(1.035);
      }
      75% {
        opacity: 0.9;
        transform: translateY(5%) translateX(-1px) scale(1.03);
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
      animation: releaseTextAppear 600ms ease-out forwards;
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
      100% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
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
  
  setTimeout(() => {
    if (confetti.parentNode) {
      confetti.parentNode.removeChild(confetti);
    }
  }, 3000);
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
    }
  }

  const loadingMsg = addMessage('bot', '…');
  isChatRequestInFlight = true;
  setChatControlsDisabled(true);
  
  try {
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Calling /api/ai/chat first with mode:', mode);
    
    await callAIChat(text, { loadingMsg });
    
    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] /api/ai/chat completed, visible reply shown');
    
    if (mode === 'pinning') {
      const freshPin = getCurrentChatPin();
      if (freshPin && !freshPin.aiAnalyzed && !freshPin.aiAnalyzing) {
        if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Starting background analyze-worry');
        
        const currentUser = getCurrentUser();
        if (currentUser) {
          const targetPin = currentUser.painPins.find(p => p.id === freshPin.id);
          if (targetPin) {
            targetPin.aiAnalyzing = true;
            UserStorage.updateUser(currentUser);
            UserStorage.setCurrentUser(currentUser.username);
          }
        }
        
        analyzeWorryWithAI(text).catch(err => {
          if (DEV_MODE) console.warn('[AI DEBUG] Background analyze-worry failed:', err);
        });
      } else if (DEV_MODE && freshPin && freshPin.aiAnalyzed) {
        console.log('[SEND MESSAGE DEBUG] Skipping background analyze-worry - analysis already saved from chat response');
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
    }, 15000);
    
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);
    
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

    processChatAIResponse({
      reply: aiResponse.reply,
      readyToPin: !!aiResponse.readyToPin,
      readyToRemove: !!aiResponse.readyToRemove,
      analysis: aiResponse.analysis,
      review: aiResponse.review
    });
    return true;
    
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
  
  if (aiResponse.analysis) {
    const currentUser = getCurrentUser();
    if (currentUser) {
      const chatPin = getCurrentChatPin();
      if (chatPin) {
        const targetPin = currentUser.painPins.find(p => p.id === chatPin.id);
        if (targetPin) {
          targetPin.coreIssue = aiResponse.analysis.coreIssue;
          targetPin.reflectionDays = aiResponse.analysis.reflectionDays;
          targetPin.warmExplanation = aiResponse.analysis.warmExplanation;
          targetPin.currentGuides = aiResponse.analysis.currentGuides;
          targetPin.aiResult = aiResponse.analysis;
          targetPin.aiAnalyzed = true;
          targetPin.aiAnalyzing = false;
          
          if (DEV_MODE) {
            console.log('[AI RESPONSE DEBUG] Analysis saved to pin:', targetPin.id, 'coreIssue:', aiResponse.analysis.coreIssue);
          }
          
          UserStorage.updateUser(currentUser);
          UserStorage.setCurrentUser(currentUser.username);
        }
      }
    }
  }
  
  const currentUser = getCurrentUser();
  
  if (mode === 'pinning' && aiResponse.readyToPin) {
    if (DEV_MODE) console.log('[AI RESPONSE DEBUG] readyToPin true, showing "交给忧忧" button');
    
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
  
  if (mode === 'review' && aiResponse.readyToRemove) {
    if (DEV_MODE) console.log('[AI RESPONSE DEBUG] readyToRemove true, showing "轻轻取下这根针" button');
    
    if (currentUser) {
      currentUser.pendingAction = 'remove';
      currentUser.pendingReviewAction = null;
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }
    
    setTimeout(() => {
      addActionButton('轻轻取下这根针', () => {
        if (currentUser) {
          currentUser.pendingAction = null;
          currentUser.pendingReviewAction = null;
          UserStorage.updateUser(currentUser);
          UserStorage.setCurrentUser(currentUser.username);
        }
        removeReviewedNeedleWithAnimation();
      });
    }, 300);
  }
  
  if (mode === 'review' && !aiResponse.readyToRemove && aiResponse.review && aiResponse.review.nextReflectionDays) {
    const reviewStage = currentUser?.reviewStage;
    
    if (DEV_MODE) {
      console.log('[AI RESPONSE DEBUG] =========================');
      console.log('[AI RESPONSE DEBUG] readyToRemove false, showing review choice buttons');
      console.log('[AI RESPONSE DEBUG] nextReflectionDays:', aiResponse.review.nextReflectionDays);
      console.log('[AI RESPONSE DEBUG] reasonCategory:', aiResponse.review.reasonCategory);
      console.log('[AI RESPONSE DEBUG] stillAffectsUser:', aiResponse.review.stillAffectsUser);
      console.log('[AI RESPONSE DEBUG] reviewStage:', reviewStage);
    }
    
    if (currentUser) {
      currentUser.reviewStage = 'review_conversation';
      currentUser.pendingAction = 'review_reschedule';
      currentUser.pendingReviewAction = {
        pinId: window.reviewingPinId || currentUser.reviewingPinId,
        nextReflectionDays: aiResponse.review.nextReflectionDays,
        reasonCategory: aiResponse.review.reasonCategory,
        stillAffectsUser: aiResponse.review.stillAffectsUser
      };
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }
    
    setTimeout(() => {
      addReviewChoiceButtons(aiResponse.review.nextReflectionDays, aiResponse.review);
    }, 300);
  }
}

function removeReviewedNeedleWithAnimation() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) {
    if (DEV_MODE) console.log('[PIN DEBUG] No user or painPins found');
    return;
  }

  currentUser.resolvedPins = currentUser.resolvedPins || [];

  let pinToRemove = null;
  let pinIndex = -1;

  if (window.reviewingPinId) {
    pinIndex = currentUser.painPins.findIndex(p => p.id === window.reviewingPinId);
    if (pinIndex !== -1) {
      pinToRemove = currentUser.painPins[pinIndex];
    }
  }

  if (!pinToRemove) {
    const oldestCompletedIndex = currentUser.painPins.findIndex(p => p.completed || p.hasNeedle);
    if (oldestCompletedIndex !== -1) {
      pinIndex = oldestCompletedIndex;
      pinToRemove = currentUser.painPins[oldestCompletedIndex];
    }
  }

  if (!pinToRemove) {
    if (DEV_MODE) console.log('[PIN DEBUG] No completed needle found to remove');
    addMessage('bot', '没有找到可以放下的针。');
    return;
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

        showReleaseCelebrationButton(() => {
          const latestUser = getCurrentUser();
          if (latestUser) {
            showPostRemovalScreen(latestUser);
          }
        });
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
        const latestUser = getCurrentUser();
        if (latestUser) {
          showPostRemovalScreen(latestUser);
        }
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
        existingBadge.textContent = getCompanionDays();
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
  
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] addReviewChoiceButtons() - nextReflectionDays:', nextReflectionDays);
    console.log('[CHAT DEBUG] addReviewChoiceButtons() - reviewData:', reviewData);
  }
  
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-review-choice-wrapper';
  
  const continueBtn = document.createElement('button');
  continueBtn.className = 'chat-review-choice-button';
  continueBtn.textContent = '继续聊聊';
  continueBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[CHAT DEBUG] "继续聊聊" clicked');
    const existingButtons = chatLog.querySelectorAll('.chat-action-button, .chat-review-choice-button');
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
  rescheduleBtn.textContent = `${nextReflectionDays}天后再看看`;
  rescheduleBtn.addEventListener('click', () => {
    rescheduleReview(nextReflectionDays, reviewData);
  });
  
  wrapper.appendChild(continueBtn);
  wrapper.appendChild(rescheduleBtn);
  
  chatLog.appendChild(wrapper);
  scrollToBottom();
}
window.addReviewChoiceButtons = addReviewChoiceButtons;

function rescheduleReview(nextReflectionDays, reviewData) {
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] =========================');
    console.log('[CHAT DEBUG] rescheduleReview() called');
    console.log('[CHAT DEBUG] nextReflectionDays:', nextReflectionDays);
    console.log('[CHAT DEBUG] reviewData:', reviewData);
  }
  
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const pinId = window.reviewingPinId || currentUser.reviewingPinId;
  if (!pinId) {
    if (DEV_MODE) console.log('[CHAT DEBUG] No pinId found for reschedule');
    return;
  }
  
  const pin = currentUser.painPins.find(p => p.id === pinId);
  if (!pin) {
    if (DEV_MODE) console.log('[CHAT DEBUG] Pin not found:', pinId);
    return;
  }
  
  const currentDay = getCurrentCompanionDay();
  const newReviewDay = currentDay + nextReflectionDays;
  
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] pin id:', pinId);
    console.log('[CHAT DEBUG] currentDay:', currentDay);
    console.log('[CHAT DEBUG] new reviewDay:', newReviewDay);
  }
  
  pin.lastReviewedAt = Date.now();
  pin.lastReviewedDay = currentDay;
  pin.reviewCount = (pin.reviewCount || 0) + 1;
  pin.reflectionDays = nextReflectionDays;
  pin.reviewDay = newReviewDay;
  pin.latestReview = reviewData;
  
  pin.reviewHistory = pin.reviewHistory || [];
  pin.reviewHistory.push({
    reviewedAt: Date.now(),
    reviewedDay: currentDay,
    nextReflectionDays: nextReflectionDays,
    reasonCategory: reviewData.reasonCategory,
    stillAffectsUser: reviewData.stillAffectsUser,
    aiReply: reviewData.aiReply || ''
  });
  
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] reviewCount:', pin.reviewCount);
    console.log('[CHAT DEBUG] reviewHistory length:', pin.reviewHistory.length);
  }
  
  if (currentUser.activePinId === pinId) {
    const stillExists = currentUser.painPins.some(p => p.id === pinId);
    if (!stillExists) {
      currentUser.activePinId = null;
    }
  }
  
  currentUser.reviewingPinId = null;
  currentUser.pendingAction = null;
  currentUser.pendingReviewAction = null;
  window.reviewingPinId = null;
  window.STABIT_CHAT_MODE = null;
  
  if (DEV_MODE) {
    console.log('[CHAT DEBUG] reviewingPinId cleared:', currentUser.reviewingPinId);
    console.log('[CHAT DEBUG] pendingAction cleared:', currentUser.pendingAction);
  }
  
  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);
  
  showHomeScreen();
  setTimeout(() => {
    if (window.showReleaseConfettiOverlay) {
      window.showReleaseConfettiOverlay();
    }
    if (window.showReleaseCelebrationText) {
      window.showReleaseCelebrationText();
    }
  }, 300);
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
        existingBadge.textContent = getCompanionDays();
      }
      
      if (DEV_MODE) {
        console.log('[FAST FORWARD DEBUG] opening review panel directly');
        console.log('[FAST FORWARD DEBUG] selected pin id:', chatPin.id);
        console.log('[FAST FORWARD DEBUG] selected reflectionDays:', reviewDays);
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
