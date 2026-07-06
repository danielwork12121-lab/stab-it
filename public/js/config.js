const SHOW_AUTH_HITBOXES = false;
const SHOW_BODY_ZONE = true;
const SHOW_CHAT_BODY_ZONE = false;

const STUFFY_BODY_ZONE = {
  centerX: 50,
  centerY: 50,
  radiusX: 22,
  radiusY: 20
};

const CHAT_BODY_SCALE = 0.69;

const CHAT_BODY_ZONE = {
  centerX: 50,
  centerY: 27,
  radiusX: STUFFY_BODY_ZONE.radiusX * CHAT_BODY_SCALE,
  radiusY: STUFFY_BODY_ZONE.radiusY * CHAT_BODY_SCALE
};

const ASSETS = {
  loginBg: '/assets/auth/login-bg.png',
  homeBg: './assets/home/stuffy-home.png',
  chatBg: './assets/chat/chat-background.png',
  painDot: '/assets/chat/pain-dot.png'
};