const MOCK_REPLIES = [
  "我在呢，慢慢说。",
  "听起来这件事真的让你很难受。",
  "你可以再多告诉我一点吗？",
  "我会先帮你把这份烦恼接住。"
];

const GREETING_MESSAGE = "我在呢，慢慢说。今天发生了什么让你不开心呀？";

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