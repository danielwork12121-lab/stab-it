const UserStorage = {
  KEY_USERS: 'stabItUsers',
  KEY_CURRENT_USER: 'stabItCurrentUser',

  getUser(username) {
    const users = this.getUsers();
    return users.find(u => u.username === username);
  },

  getUsers() {
    try {
      const data = localStorage.getItem(this.KEY_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUser(user) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.username === user.username);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
    return user;
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.KEY_CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(username) {
    const user = this.getUser(username);
    if (user) {
      localStorage.setItem(this.KEY_CURRENT_USER, JSON.stringify(user));
    }
  },

  logout() {
    localStorage.removeItem(this.KEY_CURRENT_USER);
  },

  updateUser(user) {
    return this.saveUser(user);
  },

  createNewUser(username, password) {
    const user = {
      username,
      password,
      createdAt: Date.now(),
      companionDays: 1,
      painPins: [],
      chatHistory: [],
      settings: {},
      progression: {}
    };
    return this.saveUser(user);
  }
};

function getUsers() { return UserStorage.getUsers(); }
function saveUsers(users) { 
  try {
    localStorage.setItem(UserStorage.KEY_USERS, JSON.stringify(users));
  } catch(e) { console.error(e); }
}
function getCurrentUser() { return UserStorage.getCurrentUser(); }
function setCurrentUser(user) { 
  if (user && user.username) {
    UserStorage.setCurrentUser(user.username);
  } else {
    localStorage.setItem(UserStorage.KEY_CURRENT_USER, JSON.stringify(user));
  }
}