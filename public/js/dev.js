console.log('[DEV] dev.js loaded');

function isDevModeEnabled() {
  const mode = typeof DEV_MODE !== 'undefined' ? DEV_MODE : window.DEV_MODE;
  return mode === true;
}

function removeTestUserIfExists() {
  const users = UserStorage.getUsers();
  const filteredUsers = users.filter(user => user.username !== 'test');
  localStorage.setItem(UserStorage.KEY_USERS, JSON.stringify(filteredUsers));
  localStorage.removeItem(UserStorage.KEY_CURRENT_USER);
}

function seedTestUser() {
  removeTestUserIfExists();

  const testUser = {
    username: 'test',
    password: 'test',
    createdAt: Date.now(),
    firstCompanionDate: Date.now(),
    companionDays: 1,
    painPins: [],
    chatHistory: [],
    settings: {},
    progression: {}
  };

  UserStorage.saveUser(testUser);
  UserStorage.setCurrentUser('test');

  return UserStorage.getCurrentUser();
}

function seedPainPin(user) {
  if (!user) return null;

  const normalizedPin = {
    x: 0.5,
    y: 0.55,
    createdAt: Date.now()
  };

  user.painPins = [normalizedPin];

  UserStorage.updateUser(user);
  UserStorage.setCurrentUser(user.username);

  return normalizedPin;
}

function seedChatHistory(user) {
  if (!user) return;

  user.chatHistory = [
    { role: 'bot', text: '我在呢，慢慢说。今天发生了什么让你不开心呀？' },
    { role: 'user', text: '今天我有一点难过。' },
    { role: 'bot', text: '我会先帮你把这份烦恼接住。' }
  ];

  UserStorage.updateUser(user);
  UserStorage.setCurrentUser(user.username);
}

function seedCompleteTestState() {
  const user = seedTestUser();
  seedPainPin(user);
  seedChatHistory(user);
  return UserStorage.getCurrentUser();
}

function triggerDevPinCeremony() {
  if (typeof beginPinCeremony !== 'function') {
    console.warn('[DEV] beginPinCeremony() is not available. Check public/js/chat.js.');
    return;
  }

  beginPinCeremony();
}

function handleDevHotkey(event) {
  console.log('[DEV] keydown seen:', event.key, event.target?.tagName);
  
  if (!isDevModeEnabled()) return;

  const target = event.target;

  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }

  const key = event.key.toLowerCase();

  switch (key) {
    case '1':
      event.preventDefault();
      showAuthScreen();
      console.log('[DEV] Hotkey 1: Show auth/login screen');
      break;

    case '2': {
      event.preventDefault();
      seedTestUser();
      showHomeScreen();
      console.log('[DEV] Hotkey 2: Seed test user + show home screen');
      break;
    }

    case '3': {
      event.preventDefault();
      seedCompleteTestState();
      showChatScreen();
      console.log('[DEV] Hotkey 3: Seed test user + seed pain pin + show chat screen');
      break;
    }

    case '4': {
      event.preventDefault();
      seedCompleteTestState();
      showChatScreen();

      setTimeout(() => {
        triggerDevPinCeremony();
      }, 1000);

      console.log('[DEV] Hotkey 4: Seed test user + seed pain pin + show chat screen + trigger pin ceremony');
      break;
    }

    case 't': {
      event.preventDefault();
      seedCompleteTestState();
      showHomeScreen();
      console.log('[DEV] Hotkey T: Reset/seed complete test state');
      break;
    }

    case 'r':
      event.preventDefault();
      localStorage.clear();
      location.reload();
      console.log('[DEV] Hotkey R: Clear localStorage and reload');
      break;

    case 'h':
      event.preventDefault();
      console.log(`
[DEV_MODE HOTKEYS]
1 = Show auth/login screen
2 = Seed test user + show home screen
3 = Seed test user + seed pain pin + show chat screen
4 = Seed test user + seed pain pin + show chat screen + trigger pin ceremony
T = Reset/seed complete test state
R = Clear localStorage and reload
H = Print hotkey help

Note: Hotkeys are ignored while an input or textarea is focused.
      `);
      break;
  }
}

console.log('[DEV] checking DEV_MODE:', typeof DEV_MODE, DEV_MODE, 'window.DEV_MODE:', window.DEV_MODE);

if (isDevModeEnabled()) {
  console.log('[DEV] DEV_MODE enabled. Press H for hotkeys.');
  document.addEventListener('keydown', handleDevHotkey);
  console.log('[DEV] keydown listener attached');
} else {
  console.log('[DEV] DEV_MODE not enabled, hotkeys disabled');
}