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

function getCurrentCompanionDay() {
  return getCompanionDays();
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
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] =========================');
    console.log('[REVIEW DEBUG] showReviewPanel called');
  }
  
  const existingPanel = chatScreen.querySelector('.summary-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const oldestNeedle = findOldestCompletedNeedle();
  if (!oldestNeedle) return;
  
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] pin id:', oldestNeedle.id);
  }
  
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
    issueText = oldestNeedle.warmExplanation || '这件事还需要被安放';
  }
  
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] coreIssue used:', issueText);
  }
  
  const reviewPanel = document.createElement('div');
  reviewPanel.className = 'summary-panel';
  
  const introLine = document.createElement('div');
  introLine.className = 'summary-line';
  introLine.textContent = '扎下这根针时，你写下的是：';
  introLine.style.fontSize = '14px';
  introLine.style.color = '#888';
  
  const coreIssueLine = document.createElement('div');
  coreIssueLine.className = 'summary-line core-issue';
  coreIssueLine.textContent = issueText;
  coreIssueLine.style.marginTop = '8px';
  coreIssueLine.style.marginBottom = '12px';
  
  const questionLine = document.createElement('div');
  questionLine.className = 'summary-line';
  questionLine.textContent = '现在，它还影响着你的情绪吗？';
  questionLine.style.fontSize = '16px';
  questionLine.style.marginTop = '16px';
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'summary-buttons';
  
  const enterReviewBtn = document.createElement('button');
  enterReviewBtn.className = 'summary-btn';
  enterReviewBtn.textContent = '会，它还会影响我';
  enterReviewBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 1 clicked: "会，它还会影响我"');
    enterReviewChat(oldestNeedle.id, '会，它还会影响我。');
  });
  
  const partialReviewBtn = document.createElement('button');
  partialReviewBtn.className = 'summary-btn';
  partialReviewBtn.textContent = '有一点儿，但是没当时那么难受了';
  partialReviewBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 2 clicked: "有一点儿，但是没当时那么难受了"');
    enterReviewChat(oldestNeedle.id, '有一点儿，但是没当时那么难受了。');
  });
  
  const readyToRemoveBtn = document.createElement('button');
  readyToRemoveBtn.className = 'summary-btn';
  readyToRemoveBtn.textContent = '不会了，好像已经忘记这件事儿了';
  readyToRemoveBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 3 clicked: "不会了，好像已经忘记这件事儿了"');
    directRemoveNeedle(oldestNeedle.id);
  });
  
  buttonsContainer.appendChild(enterReviewBtn);
  buttonsContainer.appendChild(partialReviewBtn);
  buttonsContainer.appendChild(readyToRemoveBtn);
  
  reviewPanel.appendChild(introLine);
  reviewPanel.appendChild(coreIssueLine);
  reviewPanel.appendChild(questionLine);
  reviewPanel.appendChild(buttonsContainer);
  chatScreen.appendChild(reviewPanel);
  
  setTimeout(() => {
    reviewPanel.classList.add('show');
  }, 50);
}

function enterReviewChat(pinId, contextMessage) {
  if (DEV_MODE) console.log('[REVIEW DEBUG] enterReviewChat - pinId:', pinId, 'context:', contextMessage);
  
  reviewingPinId = pinId;
  window.reviewingPinId = pinId;
  
  const currentUser = getCurrentUser();
  if (currentUser) {
    currentUser.reviewingPinId = pinId;
    currentUser.reviewStage = 'initial_review_analysis';
    currentUser.pendingReviewChoice = contextMessage;
    
    const targetPin = currentUser.painPins.find(p => p.id === pinId);
    if (targetPin) {
      targetPin.reviewIntroShown = true;
      targetPin.reviewStartedAt = Date.now();
    }
    
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
  
  window.STABIT_CHAT_MODE = 'review';
  
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] STABIT_MODE before clearing:', window.STABIT_MODE);
  }
  window.STABIT_MODE = null;
  
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] STABIT_MODE after clearing:', window.STABIT_MODE);
  }
  
  restoreChatPanel();
  
  if (window.addMessage) {
    window.addMessage('system', '—— 回看这根针 ——');
  }
  
  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] Auto-calling AI after pre-review choice');
    console.log('[REVIEW DEBUG] reviewStage:', currentUser?.reviewStage);
    console.log('[REVIEW DEBUG] pendingReviewChoice:', contextMessage);
  }
  
  setTimeout(() => {
    if (window.sendAutoReviewMessage) {
      window.sendAutoReviewMessage(contextMessage);
    } else {
      if (DEV_MODE) console.error('[REVIEW DEBUG] ERROR: window.sendAutoReviewMessage does not exist');
    }
  }, 600);
}

function directRemoveNeedle(pinId) {
  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] =========================');
    console.log('[REVIEW LOOP DEBUG] direct remove clicked');
    console.log('[REVIEW LOOP DEBUG] button pinId:', pinId);
  }

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) {
    if (DEV_MODE) console.error('[REVIEW LOOP DEBUG] direct remove - no currentUser or painPins');
    return;
  }

  currentUser.resolvedPins = currentUser.resolvedPins || [];

  const painPinsCountBefore = currentUser.painPins.length;
  const resolvedPinsCountBefore = currentUser.resolvedPins.length;

  if (DEV_MODE) {
    console.log('[REVIEW LOOP DEBUG] activePinId:', currentUser.activePinId);
    console.log('[REVIEW LOOP DEBUG] reviewingPinId:', currentUser.reviewingPinId);
    console.log('[REVIEW LOOP DEBUG] painPins count before:', painPinsCountBefore);
    console.log('[REVIEW LOOP DEBUG] resolvedPins count before:', resolvedPinsCountBefore);
  }

  const pinIndex = currentUser.painPins.findIndex(p => p.id === pinId);
  if (pinIndex === -1) {
    if (DEV_MODE) {
      console.error('[REVIEW LOOP DEBUG] direct remove - pin not found:', pinId);
      console.error('[REVIEW LOOP DEBUG] direct remove - not mutating any other pin');
    }
    return;
  }

  const pinToRemove = currentUser.painPins[pinIndex];

  if (DEV_MODE) console.log('[REVIEW LOOP DEBUG] reviewed pin id:', pinToRemove.id);

  const chatPanel = chatScreen.querySelector('.chat-panel');
  const pinElement = chatScreen.querySelector(`.pin-stuck[data-pin-id="${pinToRemove.id}"]`);

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
    user.pendingAction = null;
    user.pendingReviewAction = null;
    UserStorage.updateUser(user);
    UserStorage.setCurrentUser(user.username);
    
    if (DEV_MODE) {
      console.log('[REVIEW DEBUG] Pin archived to resolvedPins:', pinToRemove.id);
      console.log('[REVIEW DEBUG] old activePinId:', oldActivePinId);
      console.log('[REVIEW DEBUG] new activePinId:', user.activePinId);
      console.log('[REVIEW DEBUG] reviewingPinId cleared:', user.reviewingPinId);
      console.log('[REVIEW DEBUG] resolvedPins count:', user.resolvedPins.length);
      console.log('[REVIEW DEBUG] remaining painPins count:', user.painPins.length);
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
      }, 1250);
    } else {
      if (DEV_MODE) console.log('[REVIEW DEBUG] No DOM needle found, removing from storage only');
      const freshUser = getCurrentUser();
      archiveAndRemovePin(freshUser);
      
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
  }, 500);
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
  if (DEV_MODE) {
    console.log('[SCREEN DEBUG] showAuthScreen - hiding home/chat, showing auth');
  }
  
  phoneCanvas.style.display = 'block';
  homeScreen.style.display = 'none';
  chatScreen.style.display = 'none';
  chatScreen.classList.remove('show');
}

function showHomeScreen() {
  console.log("home background path:", ASSETS.homeBg);
  
  if (DEV_MODE) {
    const currentUser = getCurrentUser();
    console.log('[PIN DEBUG] showHomeScreen - currentUser:', currentUser?.username);
    console.log('[PIN DEBUG] showHomeScreen - painPins count:', currentUser?.painPins?.length || 0);
    console.log('[SCREEN DEBUG] showHomeScreen - hiding auth/chat, showing home');
  }
  
  phoneCanvas.style.display = 'none';
  chatScreen.style.display = 'none';
  chatScreen.classList.remove('show');
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
  if (DEV_MODE) {
    console.log('[SCREEN DEBUG] showChatScreen - hiding auth/home, showing chat');
  }
  
  phoneCanvas.style.display = 'none';
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