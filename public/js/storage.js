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
      if (!data) return null;
      
      let username = data;
      try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.username) {
          username = parsed.username;
        }
      } catch {
      }
      
      const user = this.getUser(username);
      if (DEV_MODE) {
        console.log('[STORAGE DEBUG] getCurrentUser() - username:', username, 'found:', !!user);
      }
      return user || null;
    } catch {
      return null;
    }
  },

  setCurrentUser(username) {
    localStorage.setItem(this.KEY_CURRENT_USER, username);
    if (DEV_MODE) {
      console.log('[STORAGE DEBUG] setCurrentUser() - username:', username);
    }
  },

  logout() {
    localStorage.removeItem(this.KEY_CURRENT_USER);
  },

  updateUser(user) {
    const result = this.saveUser(user);
    if (DEV_MODE) {
      console.log('[STORAGE DEBUG] updateUser() - username:', user.username, 'painPins count:', user.painPins?.length || 0);
    }
    return result;
  },

  createNewUser(username, password) {
    const user = {
      username,
      password,
      createdAt: Date.now(),
      companionDays: 1,
      painPins: [],
      resolvedPins: [],
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
  } else if (typeof user === 'string') {
    UserStorage.setCurrentUser(user);
  } else {
    localStorage.removeItem(UserStorage.KEY_CURRENT_USER);
  }
}