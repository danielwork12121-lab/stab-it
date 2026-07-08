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
  '忧忧正在帮你整理这件事...'
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
      gap: 12px;
      margin-top: auto;
      padding-bottom: 10px;
    }
    
    .summary-btn {
      padding: 12px 28px;
      border: none;
      border-radius: 25px;
      font-size: 15px;
      font-weight: 500;
      color: white;
      cursor: pointer;
      background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
      box-shadow: 0 4px 15px rgba(155, 89, 182, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      transition: all 0.2s ease;
      min-width: 120px;
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
    
    .needle-fade-away {
      z-index: 60;
      animation: needleFadeAway 1200ms ease forwards;
    }
    
    @keyframes needleFadeAway {
      0% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
        filter: blur(0);
      }
      60% {
        opacity: 0.45;
        transform: translate(-50%, -50%) scale(0.92);
        filter: blur(2px);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.75);
        filter: blur(6px);
      }
    }
  `;
  document.head.appendChild(style);
}

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

  const loadingMsg = addMessage('bot', '…');
  isChatRequestInFlight = true;
  setChatControlsDisabled(true);
  
  try {
    if (mode === 'pinning') {
      if (chatPin && !chatPin.aiAnalyzed && !chatPin.aiAnalyzing) {
        if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Pinning mode, first message - calling analyzeWorryWithAI');
        chatPin.aiAnalyzing = true;
        await analyzeWorryWithAI(text);
        if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] analyzeWorryWithAI completed, calling callAIChat');
      } else {
        if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Pinning mode, already analyzed - calling callAIChat directly');
      }
    }

    if (DEV_MODE) console.log('[SEND MESSAGE DEBUG] Calling /api/ai/chat with mode:', mode);
    await callAIChat(text, { loadingMsg });
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
  } finally {
    const pin = getCurrentChatPin();
    if (pin) {
      pin.aiAnalyzing = false;
    }
  }
}

async function processAIResult(aiResult) {
  const pin = getCurrentChatPin();
  
  if (pin) {
    pin.coreIssue = aiResult.coreIssue;
    pin.reflectionDays = aiResult.reflectionDays;
    pin.warmExplanation = aiResult.warmExplanation;
    pin.currentGuides = aiResult.currentGuides;
    pin.aiAnalyzedAt = Date.now();
    pin.aiResult = aiResult;
    pin.reviewReadyAfterDays = aiResult.reflectionDays;
    pin.aiAnalyzed = true;
    pin.aiAnalyzing = false;
    
    const currentUser = getCurrentUser();
    if (currentUser) {
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }
    
    if (DEV_MODE) console.log('[AI DEBUG] AI result saved to pin:', pin.id, 'coreIssue:', aiResult.coreIssue);
  } else {
    if (DEV_MODE) console.warn('[AI DEBUG] processAIResult called but no current chat pin found');
  }
}

async function callAIChat(userText, options = {}) {
  const pin = getCurrentChatPin();
  const mode = window.STABIT_CHAT_MODE;
  
  if (DEV_MODE) {
    console.log('[AI CHAT DEBUG] =========================');
    console.log('[AI CHAT DEBUG] Calling AI chat');
    console.log('[AI CHAT DEBUG] Mode:', mode);
    console.log('[AI CHAT DEBUG] Pin ID:', pin?.id);
    console.log('[AI CHAT DEBUG] User text:', userText.substring(0, 50));
    console.log('[AI CHAT DEBUG] Chat history length:', pin?.chatHistory?.length || 0);
  }
  
  const loadingMsg = options.loadingMsg || addMessage('bot', '…');
  
  const messages = pin && pin.chatHistory
    ? pin.chatHistory.slice(-10).map(msg => ({
        role: msg.sender === 'bot' ? 'assistant' : msg.sender,
        content: msg.text
      }))
    : [];

  if (messages.length === 0) {
    messages.push({ role: 'user', content: userText });
  }
  
  const pinInfo = pin ? {
    coreIssue: pin.coreIssue,
    reflectionDays: pin.reflectionDays,
    warmExplanation: pin.warmExplanation,
    currentGuides: pin.currentGuides,
    createdAt: pin.createdAt
  } : null;
  
  const requestBody = {
    mode,
    messages,
    pin: pinInfo
  };
  
  if (DEV_MODE) {
    console.log('[AI CHAT DEBUG] Request body:', JSON.stringify(requestBody).substring(0, 500));
  }
  
  try {
    if (DEV_MODE) console.log('[AI CHAT DEBUG] Fetching:', '/api/ai/chat');
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (DEV_MODE) {
      console.log('[AI CHAT DEBUG] Response status:', response.status);
      console.log('[AI CHAT DEBUG] Response ok:', response.ok);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const aiResponse = await response.json();
    
    if (DEV_MODE) {
      console.log('[AI CHAT DEBUG] AI response received:', aiResponse);
      console.log('[AI CHAT DEBUG] Reply:', aiResponse.reply);
    }
    
    if (!aiResponse || typeof aiResponse.reply !== 'string' || !aiResponse.reply.trim()) {
      throw new Error('Invalid AI chat response shape');
    }

    processChatAIResponse({
      reply: aiResponse.reply,
      readyToPin: !!aiResponse.readyToPin,
      readyToRemove: !!aiResponse.readyToRemove
    });
    return true;
    
  } catch (error) {
    if (DEV_MODE) {
      console.warn('[AI CHAT DEBUG] =========================');
      console.warn('[AI CHAT DEBUG] API call FAILED!');
      console.warn('[AI CHAT DEBUG] Error:', error.message);
      console.warn('[AI CHAT DEBUG] Falling back to mock reply');
    }

    const fallbackReply = mode === 'pinning' 
      ? '我在听，你可以慢慢说。准备好了，就告诉我。'
      : '我还在这里陪你。你可以慢慢看看，这件事现在有没有轻一点。';
    addMessage('bot', fallbackReply);
    saveMessage('bot', fallbackReply);
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
    console.log('[AI RESPONSE DEBUG] Mode:', mode);
  }
  
  addMessage('bot', aiResponse.reply);
  saveMessage('bot', aiResponse.reply);
  
  if (mode === 'pinning' && aiResponse.readyToPin) {
    if (DEV_MODE) console.log('[AI RESPONSE DEBUG] Pin is ready to pin, showing hint');
    setTimeout(() => {
      addMessage('bot', '如果你准备好了，可以输入 go，把这件事交给忧忧。');
      saveMessage('bot', '如果你准备好了，可以输入 go，把这件事交给忧忧。');
    }, 300);
  }
  
  if (mode === 'review' && aiResponse.readyToRemove) {
    if (DEV_MODE) console.log('[AI RESPONSE DEBUG] Pin is ready to remove, showing hint');
    setTimeout(() => {
      addMessage('bot', '如果你真的准备好了，可以输入 yes，轻轻取下这根针。');
      saveMessage('bot', '如果你真的准备好了，可以输入 yes，轻轻取下这根针。');
    }, 300);
  }
}

function removeReviewedNeedleWithAnimation() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) {
    if (DEV_MODE) console.log('[PIN DEBUG] No user or painPins found');
    return;
  }

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

  if (chatPanel) {
    chatPanel.classList.add('review-chat-fade-out');
  }

  setTimeout(() => {
    if (pinElement) {
      pinElement.classList.add('needle-fade-away');

      setTimeout(() => {
        if (pinElement.parentNode) {
          pinElement.parentNode.removeChild(pinElement);
        }

        const freshUser = getCurrentUser();
        if (freshUser && freshUser.painPins) {
          const freshIndex = freshUser.painPins.findIndex(p => p.id === pinToRemove.id);
          if (freshIndex !== -1) {
            freshUser.painPins.splice(freshIndex, 1);
            freshUser.reviewingPinId = null;
            UserStorage.updateUser(freshUser);
            UserStorage.setCurrentUser(freshUser.username);
          }
        }

        window.STABIT_CHAT_MODE = 'pinning';
        window.reviewingPinId = null;

        if (chatPanel) {
          chatPanel.remove();
        }

        const finalUser = getCurrentUser();
        if (finalUser) {
          showPostRemovalScreen(finalUser);
        }
      }, 1200);
    } else {
      if (DEV_MODE) console.log('[PIN DEBUG] Matching DOM element not found, removing from storage only');

      const freshUser = getCurrentUser();
      if (freshUser && freshUser.painPins) {
        const freshIndex = freshUser.painPins.findIndex(p => p.id === pinToRemove.id);
        if (freshIndex !== -1) {
          freshUser.painPins.splice(freshIndex, 1);
          freshUser.reviewingPinId = null;
          UserStorage.updateUser(freshUser);
          UserStorage.setCurrentUser(freshUser.username);
        }
      }

      if (window.loadSavedNeedlesToChat) {
        window.loadSavedNeedlesToChat();
      }

      window.STABIT_CHAT_MODE = 'pinning';
      window.reviewingPinId = null;

      if (chatPanel) {
        chatPanel.remove();
      }

      const finalUser = getCurrentUser();
      if (finalUser) {
        showPostRemovalScreen(finalUser);
      }
    }
  }, 450);
}

function showPostRemovalScreen(currentUser) {
  const remainingCompleted = currentUser.painPins.filter(p => p.completed || p.hasNeedle);
  
  if (remainingCompleted.length > 0) {
    const fastForwardDays = NEEDLE_REVIEW_DAYS;
    
    const demoMessage = document.createElement('div');
    demoMessage.className = 'summary-line';
    demoMessage.textContent = '为了演示，我们可以继续快进时间，看看下一根针是否也可以放下。';
    demoMessage.style.fontSize = '16px';
    demoMessage.style.opacity = '0.9';
    
    const fastForwardBtn = document.createElement('button');
    fastForwardBtn.className = 'summary-btn';
    fastForwardBtn.textContent = `快进 ${fastForwardDays} 天`;
    
    fastForwardBtn.addEventListener('click', () => {
      fastForwardCompanionDays(fastForwardDays);
      
      demoMessage.textContent = '几天过去了，点击忧忧身上的针，看看这份烦恼是否可以放下了。';
      fastForwardBtn.remove();
      
      const existingBadge = chatScreen.querySelector('.day-badge');
      if (existingBadge) {
        existingBadge.textContent = getCompanionDays();
      }
      
      window.STABIT_MODE = 'reviewNeedle';
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
  
  if (!pin.chatHistory) {
    pin.chatHistory = [];
  }
  
  pin.chatHistory.push({
    sender,
    text,
    createdAt: Date.now()
  });
  
  const currentUser = getCurrentUser();
  if (currentUser) {
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function saveMessage(sender, text) {
  const pin = getCurrentChatPin();
  saveMessageToPin(pin, sender, text);
  
  const currentUser = getCurrentUser();
  if (currentUser) {
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function loadPinChatHistory(pin) {
  if (!pin || !pin.chatHistory || pin.chatHistory.length === 0) {
    addMessage('bot', GREETING_MESSAGE);
    saveMessageToPin(pin, 'bot', GREETING_MESSAGE);
    return;
  }

  const visibleMessages = pin.chatHistory.filter(msg => {
    return !(msg.sender === 'bot' && isEphemeralBotMessage(msg.text));
  });

  if (visibleMessages.length === 0) {
    addMessage('bot', GREETING_MESSAGE);
    saveMessageToPin(pin, 'bot', GREETING_MESSAGE);
    return;
  }

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
    pinStuck.style.left = chatPoint.percentX+PIN_STUCK_OFFSET_X + '%';
    pinStuck.style.top = (chatPoint.percentY+PIN_STUCK_OFFSET_Y) + '%';
    pinStuck.style.width = PIN_STUCK_SIZE;
    chatScreen.appendChild(pinStuck);
    
    const glow = document.createElement('div');
    glow.className = 'ceremony-glow impact';
    glow.style.left = chatPoint.percentX + '%';
    glow.style.top = (chatPoint.percentY) + '%';
    chatScreen.appendChild(glow);
    
    latestPin.completed = true;
    latestPin.hasNeedle = true;
    latestPin.isAnimating = false;
    
    if (DEV_MODE) {
      console.log('[PIN DEBUG] pin marked as completed:', latestPin.x, latestPin.y);
    }
    
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
    
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
    
    const demoMessage = document.createElement('div');
    demoMessage.className = 'summary-line';
    demoMessage.textContent = '为了演示，我们可以先快进几天看看忧忧的变化。';
    demoMessage.style.fontSize = '16px';
    demoMessage.style.opacity = '0.9';
    
    const fastForwardBtn = document.createElement('button');
    fastForwardBtn.className = 'summary-btn';
    fastForwardBtn.textContent = `快进 ${DEMO_FAST_FORWARD_DAYS} 天`;
    
    fastForwardBtn.addEventListener('click', () => {
      fastForwardCompanionDays(DEMO_FAST_FORWARD_DAYS);
      
      demoMessage.textContent = '几天过去了，点击忧忧身上的针，看看这份烦恼是否可以放下了。';
      fastForwardBtn.remove();
      
      const existingBadge = chatScreen.querySelector('.day-badge');
      if (existingBadge) {
        existingBadge.textContent = getCompanionDays();
      }
      
      window.STABIT_MODE = 'reviewNeedle';
    });
    
    const demoContainer = document.createElement('div');
    demoContainer.style.display = 'flex';
    demoContainer.style.flexDirection = 'column';
    demoContainer.style.alignItems = 'center';
    demoContainer.style.gap = '20px';
    
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
