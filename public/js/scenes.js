const phoneCanvas = document.getElementById('phone-canvas');
const homeScreen = document.getElementById('home-screen');
const homeMessage = document.getElementById('home-message');
const chatScreen = document.getElementById('chat-screen');

function injectDayBadgeStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .day-badge {
      position: absolute;
      color: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      transform: translate(-50%, -50%);
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
      z-index: 100;
      background: linear-gradient(135deg, rgba(155, 89, 182, 0.85), rgba(102, 51, 153, 0.85));
      padding: 6px 14px;
      border-radius: 20px;
      box-shadow: 0 3px 12px rgba(155, 89, 182, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    }
    .pin-stuck {
      position: absolute;
      width: 15%;
      pointer-events: none;
      z-index: 15;
      transform: translate(-50%, -50%);
      transform-origin: center center;
    }
    .review-shortcut {
      position: absolute;
      bottom: 3%;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 600;
      color: white;
      background: linear-gradient(135deg, rgba(155, 89, 182, 0.9), rgba(102, 51, 153, 0.9));
      border: none;
      border-radius: 30px;
      box-shadow: 0 4px 16px rgba(155, 89, 182, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
      cursor: pointer;
      z-index: 90;
      white-space: nowrap;
      opacity: 0;
      animation: shortcutFadeIn 400ms ease-out 300ms forwards;
      transition: all 0.2s ease;
    }
    .review-shortcut:hover {
      transform: translateX(-50%) scale(1.05);
      box-shadow: 0 6px 22px rgba(155, 89, 182, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
    }
    .review-shortcut:active {
      transform: translateX(-50%) scale(0.97);
    }
    @keyframes shortcutFadeIn {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
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

function findPinById(pinId) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) return null;
  return currentUser.painPins.find(p => p.id === pinId);
}

function findEarliestScheduledNeedle() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) return null;

  const eligiblePins = currentUser.painPins.filter(p => {
    if (!(p.completed || p.hasNeedle)) return false;
    if (p.reviewDay === undefined || p.reviewDay === null) return false;
    if (!Number.isFinite(p.reviewDay) || p.reviewDay <= 0) return false;
    return true;
  });

  if (eligiblePins.length === 0) return null;

  return eligiblePins.reduce((earliest, pin) => {
    if (!earliest || pin.reviewDay < earliest.reviewDay) {
      return pin;
    }
    return earliest;
  }, null);
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

function showReviewPanel(targetPinId = null) {
  const renderStartTime = Date.now();

  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] =========================');
    console.log('[REVIEW DEBUG] showReviewPanel called', targetPinId ? 'with targetPinId: ' + targetPinId : '');
  }

  // Set explicit review state
  window.STABIT_MODE = 'reviewNeedle';
  window.STABIT_CHAT_MODE = null;

  if (DEV_MODE) console.log('[REVIEW ROUTE DEBUG] target pin:', targetPinId);

  // Hide home completely - do NOT call showHomeScreen()
  homeScreen.style.display = 'none';
  chatScreen.style.display = 'block';

  // Remove any leftover home elements that might be visible
  homeScreen.querySelectorAll('.pin-stuck').forEach(p => p.remove());
  homeScreen.querySelectorAll('.pin-review-glow').forEach(g => g.remove());
  homeScreen.querySelectorAll('.review-shortcut').forEach(s => s.remove());
  if (DEV_MODE) console.log('[REVIEW ROUTE DEBUG] removed review-ready pin leftovers');

  // Hide chat interface elements
  const chatPanel = chatScreen.querySelector('.chat-panel');
  const messageList = chatScreen.querySelector('.message-list');
  const chatInput = chatScreen.querySelector('.chat-input-container');
  const actionRow = chatScreen.querySelector('.action-row');

  if (chatPanel) chatPanel.style.display = 'none';
  if (messageList) messageList.style.display = 'none';
  if (chatInput) chatInput.style.display = 'none';
  if (actionRow) actionRow.style.display = 'none';

  if (DEV_MODE) console.log('[REVIEW ROUTE DEBUG] home hidden, chat surface shown');

  const existingPanel = chatScreen.querySelector('.summary-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // Reload user from storage to get the latest pin state
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.painPins) return;

  let targetNeedle;
  if (targetPinId) {
    targetNeedle = currentUser.painPins.find(p => p.id === targetPinId);
    if (!targetNeedle) {
      if (DEV_MODE) console.error('[REVIEW DEBUG] showReviewPanel - targetPinId not found:', targetPinId);
      return;
    }
  } else {
    targetNeedle = currentUser.painPins.find(p => p.completed || p.hasNeedle);
    if (!targetNeedle) return;
  }

  if (DEV_MODE) {
    console.log('[REVIEW DEBUG] pin id:', targetNeedle.id);
  }

  // Set reviewingPinId when targetPinId is provided
  if (targetPinId) {
    reviewingPinId = targetPinId;
    window.reviewingPinId = targetPinId;

    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.reviewingPinId = targetPinId;
      UserStorage.updateUser(currentUser);
      UserStorage.setCurrentUser(currentUser.username);
    }
  }

  // Check if pin already has valid coreIssue
  const hasValidCoreIssue = targetNeedle.coreIssue &&
                            targetNeedle.coreIssue.trim() &&
                            targetNeedle.coreIssue !== '需要整理的情绪' &&
                            targetNeedle.coreIssue !== '这件事还需要被安放' &&
                            targetNeedle.coreIssue !== '这段还未完全放下的烦恼' &&
                            targetNeedle.coreIssue !== '需要回顾的烦恼';

  // Determine initial issueText immediately (before any async operations)
  let issueText = '';
  let titleSource = 'none';

  // Title-source order: pin.coreIssue → aiResult.coreIssue → legacy fallback
  // No placeholder needed since analysis comes from /api/ai/chat response
  if (hasValidCoreIssue) {
    issueText = targetNeedle.coreIssue.trim();
    titleSource = 'pin.coreIssue';
    if (DEV_MODE) console.log('[TITLE DEBUG] review title source: stored coreIssue');
  } else if (targetNeedle.aiResult && targetNeedle.aiResult.coreIssue && targetNeedle.aiResult.coreIssue.trim() && targetNeedle.aiResult.coreIssue !== '需要整理的情绪' && targetNeedle.aiResult.coreIssue !== '这件事还需要被安放' && targetNeedle.aiResult.coreIssue !== '这段还未完全放下的烦恼' && targetNeedle.aiResult.coreIssue !== '需要回顾的烦恼') {
    issueText = targetNeedle.aiResult.coreIssue.trim();
    titleSource = 'aiResult.coreIssue';
    if (DEV_MODE) console.log('[TITLE DEBUG] summary source: pin.aiResult.coreIssue');
  } else {
    // Legacy fallback for pins created before the single-call architecture
    issueText = '这段还未完全放下的烦恼';
    titleSource = 'legacy fallback';
    if (DEV_MODE) console.log('[TITLE DEBUG] legacy fallback used');
  }

  // Ensure issueText is always a short title (max 20 chars) for review panel display
  if (issueText.length > 20) {
    issueText = issueText.substring(0, 20) + '…';
  }

  if (DEV_MODE) {
    console.log('[TITLE DEBUG] review panel title source:', titleSource);
    console.log('[TITLE DEBUG] review panel title value:', issueText);
    console.log('[TITLE DEBUG] saved coreIssue:', targetNeedle.coreIssue);
    console.log('[TITLE DEBUG] hasValidCoreIssue:', hasValidCoreIssue);
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
  enterReviewBtn.textContent = '仍然影响我';
  enterReviewBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 1 clicked: "仍然影响我"');
    enterReviewChat(targetNeedle.id, '会，它还会影响我。');
  });

  const partialReviewBtn = document.createElement('button');
  partialReviewBtn.className = 'summary-btn';
  partialReviewBtn.textContent = '有些影响';
  partialReviewBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 2 clicked: "有些影响"');
    enterReviewChat(targetNeedle.id, '有一点儿，但是没当时那么难受了。');
  });

  const readyToRemoveBtn = document.createElement('button');
  readyToRemoveBtn.className = 'summary-btn release';
  readyToRemoveBtn.textContent = '已经放下';
  readyToRemoveBtn.addEventListener('click', () => {
    if (DEV_MODE) console.log('[REVIEW DEBUG] Button 3 clicked: "已经放下"');
    directRemoveNeedle(targetNeedle.id);
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

  // Log immediate render completion
  if (DEV_MODE) {
    const renderDuration = Date.now() - renderStartTime;
    console.log('[TITLE DEBUG] review panel rendered immediately');
    console.log('[TITLE DEBUG] review panel initial render duration:', renderDuration, 'ms');
  }
}

// Async version of ensurePinAnalysis that updates the review panel when analysis completes
async function ensurePinAnalysisAsync(pinId, coreIssueLineElement) {
  // Check if analysis is already running to prevent duplicate requests
  const initialUser = UserStorage.getCurrentUser();
  const initialPin = initialUser?.painPins.find(p => p.id === pinId);

  if (initialPin && initialPin.aiAnalyzing === true) {
    if (DEV_MODE) console.log('[TITLE DEBUG] background analysis already active:', pinId);
  }

  const MAX_WAIT_MS = 15000;
  const POLL_INTERVAL_MS = 200;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // Reload user from storage to get latest pin state
    const currentUser = UserStorage.getCurrentUser();
    if (!currentUser) {
      if (DEV_MODE) console.warn('[TITLE DEBUG] ensurePinAnalysisAsync: no currentUser');
      return;
    }

    const pin = currentUser.painPins.find(p => p.id === pinId);
    if (!pin) {
      if (DEV_MODE) console.warn('[TITLE DEBUG] ensurePinAnalysisAsync: pin not found');
      return;
    }

    // Check if pin has valid coreIssue
    const hasValidCoreIssue = pin.coreIssue &&
                              pin.coreIssue.trim() &&
                              pin.coreIssue !== '需要整理的情绪' &&
                              pin.coreIssue !== '这件事还需要被安放' &&
                              pin.coreIssue !== '这段还未完全放下的烦恼' &&
                              pin.coreIssue !== '需要回顾的烦恼';

    if (hasValidCoreIssue) {
      if (DEV_MODE) console.log('[TITLE DEBUG] summary updated asynchronously:', pin.coreIssue);

      // Check if the panel is still visible and showing the same pin (prevent stale updates)
      const reviewPanel = chatScreen.querySelector('.summary-panel');
      if (!reviewPanel) {
        if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored');
        return;
      }

      // Verify we're updating the correct pin's panel
      if (window.reviewingPinId !== pinId && window.activePinId !== pinId) {
        if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored - pinId mismatch');
        return;
      }

      // Update the panel with the real coreIssue
      let updatedText = pin.coreIssue.trim();
      if (updatedText.length > 20) {
        updatedText = updatedText.substring(0, 20) + '…';
      }
      coreIssueLineElement.textContent = updatedText;

      return;
    }

    // Check if analysis is still in progress
    if (pin.aiAnalyzing === true) {
      if (DEV_MODE && Date.now() - startTime < 1000) console.log('[TITLE DEBUG] waiting for pending analysis');
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    // Analysis not in progress and no valid coreIssue - trigger analysis
    if (DEV_MODE) console.log('[TITLE DEBUG] ensurePinAnalysisAsync: triggering analyze-worry');

    // Get user text for analysis
    const userText = pin.chatHistory?.find(m => m.sender === 'user')?.text || '';
    if (userText) {
      // Set analyzing flag
      pin.aiAnalyzing = true;
      UserStorage.updateUser(currentUser);

      // Call analyzeWorryWithAI and wait for it
      try {
        await window.analyzeWorryWithAI(userText);

        // Reload pin after analysis
        const updatedUser = UserStorage.getCurrentUser();
        const updatedPin = updatedUser?.painPins.find(p => p.id === pinId);

        if (updatedPin && updatedPin.coreIssue) {
          if (DEV_MODE) console.log('[TITLE DEBUG] summary updated asynchronously:', updatedPin.coreIssue);

          // Check if the panel is still visible and showing the same pin
          const reviewPanel = chatScreen.querySelector('.summary-panel');
          if (!reviewPanel) {
            if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored');
            return;
          }

          // Verify we're updating the correct pin's panel
          if (window.reviewingPinId !== pinId && window.activePinId !== pinId) {
            if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored - pinId mismatch');
            return;
          }

          // Update the panel with the real coreIssue
          let updatedText = updatedPin.coreIssue.trim();
          if (updatedText.length > 20) {
            updatedText = updatedText.substring(0, 20) + '…';
          }
          coreIssueLineElement.textContent = updatedText;
        }
      } catch (error) {
        if (DEV_MODE) console.warn('[TITLE DEBUG] ensurePinAnalysisAsync: analyze-worry failed:', error);

        // Reset analyzing flag on failure
        const failUser = UserStorage.getCurrentUser();
        const failPin = failUser?.painPins.find(p => p.id === pinId);
        if (failPin && failPin.aiAnalyzing === true) {
          failPin.aiAnalyzing = false;
          UserStorage.updateUser(failUser);
        }

        // Set fallback on failure
        const reviewPanel = chatScreen.querySelector('.summary-panel');
        if (reviewPanel) {
          // Verify we're updating the correct pin's panel
          if (window.reviewingPinId !== pinId && window.activePinId !== pinId) {
            if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored - pinId mismatch');
            return;
          }
          coreIssueLineElement.textContent = '这件事还需要被安放';
        }
      }
    }

    return;
  }

  // Timeout - reset analyzing flag and set fallback text
  const timeoutUser = UserStorage.getCurrentUser();
  const timeoutPin = timeoutUser?.painPins.find(p => p.id === pinId);
  if (timeoutPin && timeoutPin.aiAnalyzing === true) {
    timeoutPin.aiAnalyzing = false;
    UserStorage.updateUser(timeoutUser);
  }

  const reviewPanel = chatScreen.querySelector('.summary-panel');
  if (reviewPanel) {
    // Verify we're updating the correct pin's panel
    if (window.reviewingPinId !== pinId && window.activePinId !== pinId) {
      if (DEV_MODE) console.log('[TITLE DEBUG] stale summary update ignored - pinId mismatch');
      return;
    }
    coreIssueLineElement.textContent = '这件事还需要被安放';
  }

  if (DEV_MODE) console.warn('[TITLE DEBUG] ensurePinAnalysisAsync: timeout after', MAX_WAIT_MS, 'ms');
}

function enterReviewChat(pinId, contextMessage) {
  if (DEV_MODE) console.log('[REVIEW ENTRY DEBUG] enterReviewChat started: pinId=', pinId, 'choice=', contextMessage);

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
  window.STABIT_MODE = null;

  restoreChatPanel();

  if (window.addMessage) {
    window.addMessage('system', '—— 回看这根针 ——');
  }

  if (DEV_MODE) {
    console.log('[REVIEW ENTRY DEBUG] scheduling automatic review message');
    console.log('[REVIEW ENTRY DEBUG] reviewStage:', currentUser?.reviewStage);
    console.log('[REVIEW ENTRY DEBUG] pendingReviewChoice:', contextMessage);
  }

  setTimeout(() => {
    // Guard against stale state
    if (window.STABIT_CHAT_MODE !== 'review' || window.reviewingPinId !== pinId) {
      if (DEV_MODE) console.log('[REVIEW ENTRY DEBUG] automatic send cancelled: stale review state');
      return;
    }

    // Try to get the function from window first, then fallback to module scope
    const sendFn = window.sendAutoReviewMessage ||
                   (typeof sendAutoReviewMessage === 'function' ? sendAutoReviewMessage : null);

    if (!sendFn) {
      console.error('[REVIEW ENTRY DEBUG] sendAutoReviewMessage unavailable');
      return;
    }

    if (DEV_MODE) console.log('[REVIEW ENTRY DEBUG] automatic review message invoked');

    try {
      sendFn(contextMessage);
    } catch (error) {
      console.error('[REVIEW ENTRY DEBUG] error calling sendAutoReviewMessage:', error);
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

        // Converge into universal completion flow
        completePinRemoval();
      }, 1250);
    } else {
      if (DEV_MODE) console.log('[REVIEW DEBUG] No DOM needle found, removing from storage only');
      const freshUser = getCurrentUser();
      archiveAndRemovePin(freshUser);

      // Converge into universal completion flow
      completePinRemoval();
    }
  }, 500);
}

// ============================================================
// UNIVERSAL PIN REMOVAL COMPLETION FLOW
// ============================================================
// All removal paths converge into this same completion block
// ============================================================
function completePinRemoval() {
  if (DEV_MODE) console.log('[REVIEW LOOP DEBUG] universal removal completion started');
  
  // Reset state for pin creation
  window.STABIT_MODE = null;
  window.STABIT_CHAT_MODE = 'pinning';
  window.reviewingPinId = null;
  
  // CELEBRATION_BLOCK: Same for every removal path
  showHomeScreen();
  showReleaseConfettiOverlay();
  showReleaseCelebrationText();
setTimeout(() => {
  const currentUser = getCurrentUser();

  if (currentUser) {
    currentUser.showReviewShortcut = true;
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }

  renderReviewShortcut();
}, 2800);
}
window.completePinRemoval = completePinRemoval;

function createDayBadge(parent, position) {
  if (DEV_MODE) {
    console.log("[DAY BADGE DEBUG] createDayBadge called:", parent.id);
  }

  const existingBadge = parent.querySelector('.day-badge');
  if (existingBadge) {
    existingBadge.remove();
  }

  const badge = document.createElement('div');
  badge.className = 'day-badge';

  const days = getCompanionDays();
  badge.textContent = '💗 陪伴第 ' + days + ' 天';

  badge.style.left = position.left;

  const baseTop = parseFloat(position.top);
  const adjustedTop = baseTop + (DAY_BADGE_Y_OFFSET || 0);
  badge.style.top = adjustedTop + '%';

  parent.appendChild(badge);

  if (DEV_MODE) {
    console.log("[DAY BADGE DEBUG] rendered companion badge: 💗 陪伴第 " + days + " 天");
    console.log("[DAY BADGE DEBUG] extraY: " + (DAY_BADGE_Y_OFFSET || 0));
  }
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
  homeScreen.querySelectorAll('.pin-review-glow').forEach(g => g.remove());
  homeScreen.querySelectorAll('.day-badge').forEach(b => b.remove());
  homeScreen.querySelectorAll('.review-shortcut').forEach(s => s.remove());

  loadSavedPainDots();
  createDayBadge(homeScreen, HOME_DAY_BADGE_POSITION);

  renderReviewShortcut();

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

function renderReviewShortcut() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.showReviewShortcut) {
    return;
  }

  const earliestPin = findEarliestScheduledNeedle();
  if (!earliestPin) {
    // No eligible pins, clear the flag
    currentUser.showReviewShortcut = false;
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
    if (DEV_MODE) console.log('[REVIEW SHORTCUT DEBUG] hidden: no scheduled pins');
    return;
  }

  if (DEV_MODE) {
    console.log('[REVIEW SHORTCUT DEBUG] earliest pin:', earliestPin.id, 'reviewDay:', earliestPin.reviewDay);
  }

  const currentDay = getCurrentCompanionDay();
  const daysUntilReview = earliestPin.reviewDay - currentDay;

  const shortcutBtn = document.createElement('button');
  shortcutBtn.className = 'review-shortcut';

  if (daysUntilReview <= 0) {
    shortcutBtn.textContent = '现在回看下一根针';
  } else {
    shortcutBtn.textContent = `快进 ${daysUntilReview} 天，回看下一根针`;
  }

  if (DEV_MODE) {
    console.log('[REVIEW SHORTCUT DEBUG] rendered:', daysUntilReview <= 0 ? 'now' : daysUntilReview + ' days');
  }

  shortcutBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    // Clear the shortcut flag
    currentUser.showReviewShortcut = false;
    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);

    // Remove the shortcut button
    shortcutBtn.remove();

    if (DEV_MODE) {
      console.log('[REVIEW SHORTCUT DEBUG] clicked:', earliestPin.id);
    }

    if (daysUntilReview > 0) {
      // Fast-forward to the review day
      fastForwardCompanionDays(daysUntilReview);
    }

    // Show review panel for the earliest pin
    window.STABIT_MODE = 'reviewNeedle';
    window.STABIT_CHAT_MODE = null;

    showChatScreen();

    setTimeout(() => {
      if (window.showReviewPanel) {
        window.showReviewPanel(earliestPin.id);
      }
    }, 100);
  });

  homeScreen.appendChild(shortcutBtn);
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
        console.log(`[PIN DEBUG] pin ${index}: x=${pin.x}, y=${pin.y}, completed=${pin.completed}, hasNeedle=${pin.hasNeedle}, reviewDay=${pin.reviewDay}`);
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