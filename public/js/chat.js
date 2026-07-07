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
  
  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);
  
  chatPanel.appendChild(chatLog);
  chatPanel.appendChild(inputArea);
  
  chatScreen.appendChild(chatPanel);
  
  chatInput.addEventListener('keydown', handleChatInput);
  sendBtn.addEventListener('click', sendMessage);
  
  loadChatHistory();
}

function handleChatInput(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  if (text.toLowerCase() === 'go') {
    beginPinCeremony();
    return;
  }
  
  addMessage('user', text);
  saveMessage('user', text);
  
  chatInput.value = '';
  
  setTimeout(() => {
    const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
    addMessage('bot', reply);
    saveMessage('bot', reply);
  }, 1000);
}

function addMessage(sender, text) {
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
}

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function saveMessage(sender, text) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    if (!currentUser.chatHistory) {
      currentUser.chatHistory = [];
    }
    
    currentUser.chatHistory.push({
      sender,
      text,
      createdAt: Date.now()
    });
    
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function loadChatHistory() {
  const currentUser = getCurrentUser();
  
  if (!currentUser || !currentUser.chatHistory || currentUser.chatHistory.length === 0) {
    addMessage('bot', GREETING_MESSAGE);
    saveMessage('bot', GREETING_MESSAGE);
    return;
  }
  
  currentUser.chatHistory.forEach(msg => {
    addMessage(msg.sender, msg.text);
  });
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
    showHomeMessage('忧忧会替你先收好这些烦恼。');
    setTimeout(() => {
      showHomeScreen();
    }, 2000);
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