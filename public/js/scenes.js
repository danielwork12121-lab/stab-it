const phoneCanvas = document.getElementById('phone-canvas');
const homeScreen = document.getElementById('home-screen');
const homeMessage = document.getElementById('home-message');
const chatScreen = document.getElementById('chat-screen');

function showAuthScreen() {
  phoneCanvas.style.display = 'block';
  homeScreen.style.display = 'none';
  chatScreen.style.display = 'none';
}

function showHomeScreen() {
  console.log("home background path:", ASSETS.homeBg);
  phoneCanvas.style.display = 'none';
  chatScreen.style.display = 'none';
  homeScreen.style.display = 'block';
  loadSavedPainDots();
  
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
  removeExistingPainDots();
  const dot = document.createElement('img');
  dot.className = 'pain-dot';
  dot.src = ASSETS.painDot;
  dot.style.left = percentX + '%';
  dot.style.top = percentY + '%';
  homeScreen.appendChild(dot);
  return dot;
}

function savePainDot(percentX, percentY) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    const normalized = normalizePointInZone(percentX, percentY, STUFFY_BODY_ZONE);

    currentUser.painPins = [{
      x: normalized.x,
      y: normalized.y,
      createdAt: Date.now()
    }];

    UserStorage.updateUser(currentUser);
    UserStorage.setCurrentUser(currentUser.username);
  }
}

function loadSavedPainDots() {
  removeExistingPainDots();
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.painPins && currentUser.painPins.length > 0) {
    const latestPin = currentUser.painPins[currentUser.painPins.length - 1];
    const homePoint = mapNormalizedPointToZone(latestPin, STUFFY_BODY_ZONE);

    createPainDot(
        homePoint.percentX,
        homePoint.percentY
    );
  }
}

function showHomeMessage(text) {
  homeMessage.textContent = text;
  homeMessage.classList.add('show');
  setTimeout(() => {
    homeMessage.classList.remove('show');
  }, 2000);
}

function goToChatScene() {
  showChatScreen();
}

function showChatScreen() {
  homeScreen.style.display = 'none';
  
  chatScreen.style.display = 'block';
  chatScreen.querySelectorAll('.pain-dot').forEach(dot => dot.remove());
  chatScreen.querySelectorAll('.body-zone-outline').forEach(o => o.remove());
  chatScreen.querySelectorAll('.body-zone-label').forEach(l => l.remove());

  setTimeout(() => {
    chatScreen.classList.add('show');
  }, 50);
  
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.painPins && currentUser.painPins.length > 0) {
    const latestPin = currentUser.painPins[currentUser.painPins.length - 1];
    
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
}