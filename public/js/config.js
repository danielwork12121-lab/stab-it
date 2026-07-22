const DEV_MODE = true;
window.DEV_MODE = DEV_MODE;
const SHOW_AUTH_HITBOXES = false;
const SHOW_BODY_ZONE = false;
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
  homeBg: '/assets/home/stuffy-home.JPG',
  chatBg: '/assets/chat/chat-background.JPG',
  painDot: '/assets/chat/pain-dot.png',
  pinStuck: '/assets/pin/pin-stuck.png',
  backgroundMusic: '/assets/audio/background-music.wav',
  pinImpactSound: '/assets/audio/pin-impact.qta',
  celebrationSound: '/assets/audio/celebration.m4a'
};

const HOME_DAY_BADGE_POSITION = {
  left: '20.5%',
  top: '10.4%'
};

const CHAT_DAY_BADGE_POSITION = {
  left: '21%',
  top: '6.4%'
};

const DAY_BADGE_Y_OFFSET = 1.5;

const PIN_STUCK_SIZE = '15%';
const PIN_STUCK_OFFSET_X = 1.5;
const PIN_STUCK_OFFSET_Y = -1.4;

const DEMO_FAST_FORWARD_DAYS = 3;
const REVIEW_UNLOCK_DAYS = DEMO_FAST_FORWARD_DAYS;
const NEEDLE_REVIEW_DAYS = DEMO_FAST_FORWARD_DAYS;