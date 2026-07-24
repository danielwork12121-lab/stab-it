function restoreAppState() {
  const currentUser = UserStorage.getCurrentUser();

  if (DEV_MODE) {
    console.log('[RESTORE DEBUG] =========================');
    console.log('[RESTORE DEBUG] restoreAppState called');
    console.log('[RESTORE DEBUG] currentUser exists:', !!currentUser);
    console.log('[RESTORE DEBUG] currentUser:', currentUser?.username || 'null');
    console.log('[RESTORE DEBUG] activePinId:', currentUser?.activePinId);
    console.log('[RESTORE DEBUG] reviewingPinId:', currentUser?.reviewingPinId);
    console.log('[RESTORE DEBUG] pendingAction:', currentUser?.pendingAction);
    console.log('[RESTORE DEBUG] phoneCanvas visible:', phoneCanvas?.style.display !== 'none');
    console.log('[RESTORE DEBUG] homeScreen visible:', homeScreen?.style.display !== 'none');
    console.log('[RESTORE DEBUG] chatScreen visible:', chatScreen?.style.display !== 'none');
  }

  if (!currentUser) {
    if (DEV_MODE) console.log('[RESTORE DEBUG] No currentUser, showing auth screen');
    UserStorage.logout();
    showAuthScreen();
    return;
  }

  if (currentUser.reviewingPinId) {
    const pin = currentUser.painPins?.find(p => p.id === currentUser.reviewingPinId);
    if (pin) {
      if (DEV_MODE) {
        console.log('[RESTORE DEBUG] Restoring review mode for pin:', pin.id);
        console.log('[RESTORE DEBUG] Chat history length:', pin.chatHistory?.length || 0);
        console.log('[RESTORE DEBUG] pendingAction:', currentUser.pendingAction);
        console.log('[RESTORE DEBUG] pendingReviewAction:', currentUser.pendingReviewAction);
      }
      window.STABIT_CHAT_MODE = 'review';
      showChatScreen();
      if (currentUser.pendingAction === 'remove') {
        if (DEV_MODE) console.log('[RESTORE DEBUG] Restoring pending remove action');
        setTimeout(() => {
          if (window.addActionButton) {
            window.addActionButton('轻轻取下这根针', () => {
              removeReviewedNeedleWithAnimation();
            });
            if (DEV_MODE) console.log('[RESTORE DEBUG] Action button "轻轻取下这根针" restored');
          } else {
            if (DEV_MODE) console.warn('[RESTORE DEBUG] addActionButton not available on window');
          }
        }, 500);
      } else if (currentUser.pendingAction === 'review_reschedule' && currentUser.pendingReviewAction) {
        if (DEV_MODE) console.log('[RESTORE DEBUG] Restoring pending review reschedule action');
        setTimeout(() => {
          if (window.addReviewChoiceButtons) {
            window.addReviewChoiceButtons(
              currentUser.pendingReviewAction.nextReflectionDays,
              currentUser.pendingReviewAction
            );
            if (DEV_MODE) console.log('[RESTORE DEBUG] Review choice buttons restored');
          } else {
            if (DEV_MODE) console.warn('[RESTORE DEBUG] addReviewChoiceButtons not available on window');
          }
        }, 500);
      }
      return;
    }
    if (DEV_MODE) console.log('[RESTORE DEBUG] reviewingPinId points to missing pin, clearing');
    currentUser.reviewingPinId = null;
    currentUser.pendingAction = null;
    currentUser.pendingReviewAction = null;
  }

  if (currentUser.activePinId) {
    const pin = currentUser.painPins?.find(p => p.id === currentUser.activePinId);
    // Only restore pinning mode if not already in review mode
    if (pin && !pin.completed && !currentUser.reviewingPinId) {
      if (DEV_MODE) {
        console.log('[RESTORE DEBUG] Restoring pinning mode for pin:', pin.id);
        console.log('[RESTORE DEBUG] Pin completed:', pin.completed);
        console.log('[RESTORE DEBUG] Chat history length:', pin.chatHistory?.length || 0);
      }
      window.STABIT_CHAT_MODE = 'pinning';
      showChatScreen();
      if (currentUser.pendingAction === 'pin') {
        if (DEV_MODE) console.log('[RESTORE DEBUG] Restoring pending pin action');
        setTimeout(() => {
          if (window.addActionButton) {
            window.addActionButton('交给忧忧', () => {
              beginPinCeremony();
            });
            if (DEV_MODE) console.log('[RESTORE DEBUG] Action button "交给忧忧" restored');
          } else {
            if (DEV_MODE) console.warn('[RESTORE DEBUG] addActionButton not available on window');
          }
        }, 500);
      }
      return;
    }
    if (DEV_MODE) console.log('[RESTORE DEBUG] activePinId points to missing/completed pin, clearing');
    currentUser.activePinId = null;
  }

  if (currentUser.pendingAction && !currentUser.activePinId && !currentUser.reviewingPinId) {
    if (DEV_MODE) console.log('[RESTORE DEBUG] Clearing orphaned pendingAction:', currentUser.pendingAction);
    currentUser.pendingAction = null;
    currentUser.pendingReviewAction = null;
  }

  UserStorage.updateUser(currentUser);
  UserStorage.setCurrentUser(currentUser.username);
  if (DEV_MODE) console.log('[RESTORE DEBUG] Showing home screen');
  showHomeScreen();
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initAudio();

  homeScreen.addEventListener('click', (e) => {
    // Guard: prevent pin creation during review mode
    if (window.STABIT_MODE === 'reviewNeedle') {
      if (DEV_MODE) console.log('[REVIEW ROUTE DEBUG] home click blocked during review');
      return;
    }

    const rect = homeScreen.getBoundingClientRect();
    const percentX = ((e.clientX - rect.left) / rect.width) * 100;
    const percentY = ((e.clientY - rect.top) / rect.height) * 100;

    if (isInsideBodyZone(percentX, percentY)) {
      // Clear review shortcut flag when starting new pin
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.showReviewShortcut) {
        currentUser.showReviewShortcut = false;
        UserStorage.updateUser(currentUser);
        UserStorage.setCurrentUser(currentUser.username);
        if (DEV_MODE) console.log('[REVIEW SHORTCUT DEBUG] cleared by pinning');
      }

      createPainDot(percentX, percentY);
      savePainDot(percentX, percentY);
      showHomeMessage('烦恼已经被忧忧接住了。');
      setTimeout(() => {
        goToChatScene();
      }, 1000);
    } else {
      showHomeMessage('请点击忧忧身上的位置来记录烦恼');
    }
  });

  restoreAppState();
});