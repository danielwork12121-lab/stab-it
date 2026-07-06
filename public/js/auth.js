const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const usernameError = document.getElementById('username-error');
const passwordError = document.getElementById('password-error');
const authMessage = document.getElementById('auth-message');

let isRegisterMode = false;

if (SHOW_AUTH_HITBOXES) {
  const createHitboxLabel = (element, label) => {
    const labelEl = document.createElement('div');
    labelEl.className = 'hitbox-label';
    labelEl.textContent = label;
    const rect = element.getBoundingClientRect();
    labelEl.style.left = (element.offsetLeft - 2) + 'px';
    labelEl.style.top = (element.offsetTop - 18) + 'px';
    phoneCanvas.appendChild(labelEl);
  };
  
  createHitboxLabel(usernameInput, 'username');
  createHitboxLabel(passwordInput, 'password');
  createHitboxLabel(loginButton, 'login');
  createHitboxLabel(registerButton, 'register');
}

function showAuthMessage(text) {
  authMessage.textContent = text;
  authMessage.classList.add('show');
}

function clearErrors() {
  usernameError.textContent = '';
  passwordError.textContent = '';
}

function validateUsername(username) {
  if (!username.trim()) {
    return '请输入用户名';
  }
  return '';
}

function validatePassword(password) {
  if (!password) {
    return '请输入密码';
  }
  return '';
}

function switchMode() {
  isRegisterMode = !isRegisterMode;
  clearErrors();
  usernameInput.value = '';
  passwordInput.value = '';
  
  if (isRegisterMode) {
    usernameInput.placeholder = '设置用户名';
    passwordInput.placeholder = '设置密码';
  } else {
    usernameInput.placeholder = '用户名';
    passwordInput.placeholder = '密码';
  }
}

function handleLogin() {
  clearErrors();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  console.log("login clicked", username, password);
  console.log("saved users", UserStorage.getUsers());
  
  if (!username || !password) {
    showAuthMessage('请填写昵称和密码');
    return;
  }
  
  const usernameErr = validateUsername(username);
  const passwordErr = validatePassword(password);
  
  if (usernameErr) {
    usernameError.textContent = usernameErr;
    return;
  }
  if (passwordErr) {
    passwordError.textContent = passwordErr;
    return;
  }
  
  const matchedUser = UserStorage.getUser(username);
  console.log("login matched user", matchedUser);
  
  if (matchedUser && matchedUser.password === password) {
    UserStorage.setCurrentUser(username);
    showAuthMessage('登录成功，正在进入忧忧…');
    setTimeout(() => {
      showHomeScreen();
    }, 600);
  } else {
    showAuthMessage('昵称或密码不正确');
  }
}

function handleRegister() {
  clearErrors();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  console.log("register clicked", username, password);
  
  if (!username || !password) {
    showAuthMessage('请填写昵称和密码');
    return;
  }
  
  const usernameErr = validateUsername(username);
  const passwordErr = validatePassword(password);
  
  if (usernameErr) {
    usernameError.textContent = usernameErr;
    return;
  }
  if (passwordErr) {
    passwordError.textContent = passwordErr;
    return;
  }
  
  if (UserStorage.getUser(username)) {
    showAuthMessage('这个昵称已经被注册了');
    return;
  }
  
  UserStorage.createNewUser(username, password);
  console.log("saved users", UserStorage.getUsers());
  showAuthMessage('注册成功，请点击登录进入');
  
  isRegisterMode = false;
  usernameInput.placeholder = '用户名';
  passwordInput.placeholder = '密码';
}

function addButtonPressFeedback(button) {
  button.addEventListener('mousedown', () => button.classList.add('button-pressed'));
  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    button.classList.add('button-pressed');
  });
  button.addEventListener('mouseup', () => button.classList.remove('button-pressed'));
  button.addEventListener('mouseleave', () => button.classList.remove('button-pressed'));
  button.addEventListener('touchend', () => button.classList.remove('button-pressed'));
}

function initAuth() {
  loginButton.addEventListener('click', handleLogin);
  registerButton.addEventListener('click', handleRegister);
  
  addButtonPressFeedback(loginButton);
  addButtonPressFeedback(registerButton);
  
  usernameInput.addEventListener('input', clearErrors);
  passwordInput.addEventListener('input', clearErrors);
}