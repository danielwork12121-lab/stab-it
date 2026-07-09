const phoneCanvas = document.getElementById('phone-canvas');
const homeScreen = document.getElementById('home-screen');
const homeMessage = document.getElementById('home-message');
const chatScreen = document.getElementById('chat-screen');

function injectDayBadgeStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .day-badge {
      position: absolute;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      transform: none;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .pin-stuck {
      position: absolute;
      width: 15%;
      pointer-events: none;
      z-index: 15;
      transform: translate(-50%, -50%);
      transform-origin: center center;
    }
  `;
  document.head.appendChild(style);
}

function getCompanionDays() {
  const currentUser = getCurrentUser();
  if (!currentUser) return 1;
  
  let firstDate = currentUser.firstCompanionDate;
  if (!firstDate) {
    firstDate = currentUser.createdAt || Date.now();
    currentUser.firstCompanionDate = firstDate;
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
  
  const days = Math.floor((Date.now() - new Date(firstDate).getTime()) / 86400000) + 1;
  const offset = currentUser.companionDayOffset || 0;
  return Math.max(1, days + offset);
}

function fastForwardCompanionDays(days) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  currentUser.companionDayOffset = (currentUser.companionDayOffset || 0) + days;
  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);
}

let reviewingPinId = null;
window.reviewingPinId = reviewingPinId;

function removeNeedle(pinId) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) return;
  
  const pinIndex = currentUser.painPins.findIndex(p => p.id === pinId);
  if (pinIndex === -1) return;
  
  const removedPin = currentUser.painPins[pinIndex];
  if (!removedPin || (!removedPin.completed && !removedPin.hasNeedle)) return;
  
  currentUser.painPins.splice(pinIndex, 1);
  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);
  
  return removedPin;
}
window.removeNeedle = removeNeedle;

function animateNeedleRemoval(pinElements) {
  pinElements.forEach(pinEl => {
    pinEl.classList.add('needle-fade-away');
  });
  
  setTimeout(() => {
    pinElements.forEach(pinEl => {
      if (pinEl.parentNode) {
        pinEl.parentNode.removeChild(pinEl);
      }
    });
  }, 1200);
}
window.animateNeedleRemoval = animateNeedleRemoval;

function findOldestCompletedNeedle() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) return null;
  
  return currentUser.painPins.find(p => p.completed || p.hasNeedle);
}

function restoreChatPanel() {
  const existingPanel = chatScreen.querySelector('.summary-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  if (window.showChatInterface) {
    window.showChatInterface();
  }
}

function showReviewPanel() {
  const existingPanel = chatScreen.querySelector('.summary-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const oldestNeedle = findOldestCompletedNeedle();
  if (!oldestNeedle) return;
  
  let issueText = oldestNeedle.coreIssue || '';
  if (!issueText && oldestNeedle.chatHistory && oldestNeedle.chatHistory.length > 0) {
    const firstUserMsg = oldestNeedle.chatHistory.find(msg => msg.sender === 'user');
    if (firstUserMsg) {
      issueText = firstUserMsg.text.substring(0, 20);
      if (firstUserMsg.text.length > 20) {
        issueText += '...';
      }
    }
  }
  
  if (!issueText) {
    issueText = '一份未说出口的烦恼';
  }
  
  const reviewPanel = document.createElement('div');
  reviewPanel.className = 'summary-panel';
  
  const message1 = document.createElement('div');
  message1.className = 'summary-line primary';
  message1.textContent = `上次这根针里，你放下的是：${issueText}。`;
  
  const message2 = document.createElement('div');
  message2.className = 'summary-line';
  message2.textContent = '现在回头看，它还像那天一样刺痛吗？';
  message2.style.fontSize = '16px';
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'summary-buttons';
  
  const readyBtn = document.createElement('button');
    readyBtn.className = 'summary-btn';
    readyBtn.textContent = '我准备放下了';
    readyBtn.addEventListener('click', () => {
      const pinId = oldestNeedle.id;
      reviewingPinId = pinId;
      window.reviewingPinId = pinId;
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        currentUser.reviewingPinId = pinId;
        
        const targetPin = currentUser.painPins.find(p => p.id === pinId);
        if (targetPin) {
          targetPin.reviewIntroShown = true;
          targetPin.reviewStartedAt = Date.now();
        }
        
        UserStorage.updateUser(currentUser);
        UserStorage.setCurrentUser(currentUser.username);
      }
      
      window.STABIT_CHAT_MODE = 'review';
      
      restoreChatPanel();
      
      if (window.addMessage) {
        window.addMessage('system', '—— 回看这根针 ——');
        window.addMessage('bot', '能说出这句话已经很不容易了。那我们一起确认一下：这份烦恼，现在真的可以放下了吗？');
      }
    });
  
  const waitBtn = document.createElement('button');
    waitBtn.className = 'summary-btn';
    waitBtn.textContent = '我还想再等等';
    waitBtn.addEventListener('click', () => {
      const pinId = oldestNeedle.id;
      reviewingPinId = pinId;
      window.reviewingPinId = pinId;
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        currentUser.reviewingPinId = pinId;
        
        const targetPin = currentUser.painPins.find(p => p.id === pinId);
        if (targetPin) {
          targetPin.reviewIntroShown = true;
          targetPin.reviewStartedAt = Date.now();
        }
        
        UserStorage.updateUser(currentUser);
        UserStorage.setCurrentUser(currentUser.username);
      }
      
      window.STABIT_CHAT_MODE = 'review';
      
      restoreChatPanel();
      
      if (window.addMessage) {
        window.addMessage('system', '—— 回看这根针 ——');
        window.addMessage('bot', '没关系，忧忧会再陪它一会儿。你可以再说说，现在最放不下的部分是什么？');
      }
    });
  
  buttonsContainer.appendChild(readyBtn);
  buttonsContainer.appendChild(waitBtn);
  
  reviewPanel.appendChild(message1);
  reviewPanel.appendChild(message2);
  reviewPanel.appendChild(buttonsContainer);
  chatScreen.appendChild(reviewPanel);
  
  setTimeout(() => {
    reviewPanel.classList.add('show');
  }, 50);
}

function createDayBadge(parent, position) {
  console.log("createDayBadge called:", parent.id);

  const existingBadge = parent.querySelector('.day-badge');
  if (existingBadge) {
    existingBadge.remove();
  }

  const badge = document.createElement('div');
  badge.className = 'day-badge';

  badge.textContent = getCompanionDays();

  badge.style.left = position.left;
  badge.style.top = position.top;

  // DEBUG STYLE
  badge.style.position = "absolute";

  parent.appendChild(badge);

  console.log("Badge appended.");
}

injectDayBadgeStyles();

function showAuthScreen() {
  phoneCanvas.style.display = 'block';
  homeScreen.style.display = 'none';
  chatScreen.style.display = 'none';
}

function showHomeScreen() {
  console.log("home background path:", ASSETS.homeBg);
  
  if (DEV_MODE) {
    const currentUser = getCurrentUser();
    console.log('[PIN DEBUG] showHomeScreen - currentUser:', currentUser?.username);
    console.log('[PIN DEBUG] showHomeScreen - painPins count:', currentUser?.painPins?.length || 0);
  }
  
  phoneCanvas.style.display = 'none';
  chatScreen.style.display = 'none';
  homeScreen.style.display = 'block';
  
  chatScreen.querySelectorAll('.chat-panel').forEach(p => p.remove());
  chatScreen.querySelectorAll('.summary-panel').forEach(p => p.remove());
  chatScreen.querySelectorAll('.pin-stuck').forEach(p => p.remove());
  chatScreen.querySelectorAll('.ceremony-projectile').forEach(p => p.remove());
  chatScreen.querySelectorAll('.ceremony-glow').forEach(g => g.remove());
  chatScreen.querySelectorAll('.pain-dot').forEach(d => d.remove());
  chatScreen.classList.remove('show');
  
  homeScreen.querySelectorAll('.body-zone-outline').forEach(o => o.remove());
  homeScreen.querySelectorAll('.body-zone-label').forEach(l => l.remove());
  homeScreen.querySelectorAll('.pin-stuck').forEach(p => p.remove());

  loadSavedPainDots();
  createDayBadge(homeScreen, HOME_DAY_BADGE_POSITION);
  
  if (SHOW_BODY_ZONE) {
    const outline = document.createElement('div');
    outline.className = 'body-zone-outline';
    outline.style.left = (STUFFY_BODY_ZONE.centerX - STUFFY_BODY_ZONE.radiusX) + '%';
    outline.style.top = (STUFFY_BODY_ZONE.centerY - STUFFY_BODY_ZONE.radiusY) + '%';
    outline.style.width = (STUFFY_BODY_ZONE.radiusX * 2) + '%';
    outline.style.height = (STUFFY_BODY_ZONE.radiusY * 2) + '%';
    homeScreen.appendChild(outline);
    
    const label = document.createElement('div');
    label.className = 'body-zone-label';
    label.textContent = 'body-zone';
    label.style.left = (STUFFY_BODY_ZONE.centerX - STUFFY_BODY_ZONE.radiusX) + '%';
    label.style.top = (STUFFY_BODY_ZONE.centerY - STUFFY_BODY_ZONE.radiusY - 15) + '%';
    homeScreen.appendChild(label);
  }
}

function removeExistingPainDots() {
  const dots = homeScreen.querySelectorAll('.pain-dot');
  dots.forEach(dot => dot.remove());
}

function createPainDot(percentX, percentY) {
  const dot = document.createElement('img');
  dot.className = 'pain-dot';
  dot.src = ASSETS.painDot;
  dot.style.width = PAIN_DOT_CHAT_SIZE;
  dot.style.left = percentX + '%';
  dot.style.top = percentY + '%';
  homeScreen.appendChild(dot);
  return dot;
}

function savePainDot(percentX, percentY) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    const normalized = normalizePointInZone(percentX, percentY, STUFFY_BODY_ZONE);

    currentUser.painPins = currentUser.painPins || [];
    currentUser.resolvedPins = currentUser.resolvedPins || [];
    
    const newPin = {
      id: 'pin-' + Date.now(),
      x: normalized.x,
      y: normalized.y,
      createdAt: Date.now(),
      chatHistory: []
    };
    
    currentUser.painPins.push(newPin);
    currentUser.activePinId = newPin.id;
    currentUser.reviewingPinId = null;
    
    window.reviewingPinId = null;
    window.STABIT_CHAT_MODE = 'pinning';
    
    if (DEV_MODE) {
      console.log('[PIN DEBUG] New pin created, reviewingPinId cleared');
    }

    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function migratePins() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  let needsSave = false;
  
  if (!currentUser.resolvedPins) {
    currentUser.resolvedPins = [];
    needsSave = true;
  }
  
  if (!currentUser.painPins) {
    currentUser.painPins = [];
    needsSave = true;
  }
  
  currentUser.painPins.forEach((pin, index) => {
    if (!pin.id) {
      pin.id = 'pin-' + (pin.createdAt || Date.now()) + '-' + index;
      needsSave = true;
    }
    
    if (!pin.chatHistory) {
      pin.chatHistory = [];
      needsSave = true;
    }
  });
  
  if (!currentUser.activePinId && currentUser.painPins.length > 0) {
    currentUser.activePinId = currentUser.painPins[currentUser.painPins.length - 1].id;
    needsSave = true;
  }
  
  if (needsSave) {
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function loadSavedPainDots() {
  migratePins();
  
  removeExistingPainDots();
  homeScreen.querySelectorAll('.pin-stuck').forEach(p => p.remove());
  
  const currentUser = getCurrentUser();
  
  if (DEV_MODE) {
    console.log('[PIN DEBUG] loading saved pins:', currentUser?.painPins?.length || 0);
    if (currentUser?.painPins) {
      currentUser.painPins.forEach((pin, index) => {
        console.log(`[PIN DEBUG] pin ${index}: x=${pin.x}, y=${pin.y}, completed=${pin.completed}, hasNeedle=${pin.hasNeedle}`);
      });
    }
  }
  
  if (currentUser && currentUser.painPins && currentUser.painPins.length > 0) {
    currentUser.painPins.forEach(pin => {
      if ((pin.completed || pin.hasNeedle) && !pin.isAnimating) {
        const homePoint = mapNormalizedPointToZone(pin, STUFFY_BODY_ZONE);
        
        if (DEV_MODE) {
          console.log('[PIN DEBUG] rendering historical needle at:', homePoint.percentX, homePoint.percentY);
        }
        
        console.log("[PIN RENDER]", {
  original: pin,
  mapped: homePoint
});

        const pinStuck = document.createElement('img');
        pinStuck.className = 'pin-stuck';
        pinStuck.src = ASSETS.pinStuck;
        pinStuck.dataset.pinId = pin.id;

        pinStuck.style.width = "22%";
        pinStuck.style.left = homePoint.percentX + '%';
        pinStuck.style.top = homePoint.percentY + '%';
        pinStuck.style.transform = 'translate(-50%, -50%)';

        homeScreen.appendChild(pinStuck);
      } else {
        if (DEV_MODE) {
          console.log('[PIN DEBUG] skipping incomplete pin:', pin.x, pin.y);
        }
      }
    });
  }
}

function loadSavedNeedlesToChat() {
  migratePins();
  
  const currentUser = getCurrentUser();

  if (!currentUser || !currentUser.painPins) return;

  chatScreen.querySelectorAll('.pin-stuck').forEach(p => p.remove());

  currentUser.painPins.forEach(pin => {

    if (pin.completed || pin.hasNeedle) {

      const chatPoint = mapNormalizedPointToZone(
        pin,
        CHAT_BODY_ZONE
      );

      const pinStuck = document.createElement('img');

      pinStuck.className = 'pin-stuck';
      pinStuck.src = ASSETS.pinStuck;
      pinStuck.dataset.pinId = pin.id;

      pinStuck.style.width = PIN_STUCK_SIZE;
      pinStuck.style.left = chatPoint.percentX + '%';
      pinStuck.style.top = chatPoint.percentY + '%';

      pinStuck.style.transform =
        'translate(-50%, -50%)';

      chatScreen.appendChild(pinStuck);
    }

  });
}
window.loadSavedNeedlesToChat = loadSavedNeedlesToChat;

function showHomeMessage(text) {
  homeMessage.textContent = text;
  homeMessage.classList.add('show');
  setTimeout(() => {
    homeMessage.classList.remove('show');
  }, 2000);
}

function goToChatScene() {
  window.STABIT_CHAT_MODE = 'pinning';
  showChatScreen();
}

function showChatScreen() {
  homeScreen.style.display = 'none';
  
  chatScreen.style.display = 'block';
  loadSavedNeedlesToChat();
  chatScreen.querySelectorAll('.pain-dot').forEach(dot => dot.remove());
  chatScreen.querySelectorAll('.body-zone-outline').forEach(o => o.remove());
  chatScreen.querySelectorAll('.body-zone-label').forEach(l => l.remove());
  chatScreen.querySelectorAll('.day-badge').forEach(b => b.remove());

  setTimeout(() => {
    chatScreen.classList.add('show');
  }, 50);
  
  
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.painPins && currentUser.painPins.length > 0) {
    const latestPin = currentUser.painPins[currentUser.painPins.length - 1];
    if (!latestPin.completed && !latestPin.hasNeedle) {
      const dot = document.createElement('img');
      dot.className = 'pain-dot';
      dot.src = ASSETS.painDot;
      
      if (latestPin.x !== undefined && latestPin.y !== undefined) {
        const chatPoint = mapNormalizedPointToZone(latestPin, CHAT_BODY_ZONE);

        dot.style.left = chatPoint.percentX + '%';
        dot.style.top = chatPoint.percentY + '%';

        chatScreen.appendChild(dot);
      }
    }
  }
  
  if (SHOW_CHAT_BODY_ZONE) {
    const outline = document.createElement('div');
    outline.className = 'body-zone-outline';
    outline.style.left = (CHAT_BODY_ZONE.centerX - CHAT_BODY_ZONE.radiusX) + '%';
    outline.style.top = (CHAT_BODY_ZONE.centerY - CHAT_BODY_ZONE.radiusY) + '%';
    outline.style.width = (CHAT_BODY_ZONE.radiusX * 2) + '%';
    outline.style.height = (CHAT_BODY_ZONE.radiusY * 2) + '%';
    chatScreen.appendChild(outline);
    
    const label = document.createElement('div');
    label.className = 'body-zone-label';
    label.textContent = 'chat-body-zone';
    label.style.left = (CHAT_BODY_ZONE.centerX - CHAT_BODY_ZONE.radiusX) + '%';
    label.style.top = (CHAT_BODY_ZONE.centerY - CHAT_BODY_ZONE.radiusY - 15) + '%';
    chatScreen.appendChild(label);
  }
  
  initChatScreen();
  createDayBadge(chatScreen, CHAT_DAY_BADGE_POSITION);

}