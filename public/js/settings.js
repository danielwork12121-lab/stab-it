/**
 * StabIt Settings Modal — refined isolated settings panel.
 * Reuses existing auth/audio/storage APIs. No duplicate state.
 */
const StabItSettings = {
  _overlay: null,
  _panel: null,
  _gearButton: null,
  _isOpen: false,
  _confirmVisible: false,
  _changingPassword: false,
  _passwordVisible: false,

  init() {
    this._createGearButton();
    this._createModal();
    this._attachKeyboardListener();
    if (DEV_MODE) console.log('[SETTINGS] initialized');
  },

  // ── Gear Button ──────────────────────────────────────

  _createGearButton() {
    const btn = document.createElement('button');
    btn.className = 'stabit-settings-button';
    btn.setAttribute('aria-label', '打开设置');
    btn.setAttribute('title', '设置');
    btn.innerHTML = this._gearIconSVG();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });

    const homeScreen = document.getElementById('home-screen');
    const chatScreen = document.getElementById('chat-screen');
    if (homeScreen) homeScreen.appendChild(btn);
    if (chatScreen) {
      const clone = btn.cloneNode(true);
      clone.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open();
      });
      chatScreen.appendChild(clone);
    }
    this._gearButton = btn;
  },

  _gearIconSVG() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;
  },

  // ── Modal Construction ─────────────────────────────────

  _createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'stabit-settings-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const panel = document.createElement('div');
    panel.className = 'stabit-settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'stabit-settings-title');
    panel.innerHTML = this._mainHTML();

    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { /* intentionally do nothing */ }
    });

    this._overlay = overlay;
    this._panel = panel;
    this._attachPanelListeners();
    document.body.appendChild(overlay);
  },

  _mainHTML() {
    return `
      <div class="stabit-settings-header">
        <span id="stabit-settings-title" class="stabit-settings-title">设置</span>
        <button class="stabit-settings-close" aria-label="关闭设置" title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="stabit-settings-body">

        <!-- Account surface -->
        <div class="stabit-settings-surface">
          <div class="stabit-settings-account-row">
            <span class="stabit-settings-account-label">名称</span>
            <span class="stabit-settings-account-value" id="stabit-settings-username">—</span>
          </div>
          <div class="stabit-settings-account-row stabit-settings-account-row-linkable" id="stabit-settings-password-row">
            <span class="stabit-settings-account-label">密码</span>
            <div class="stabit-settings-password-display">
              <span class="stabit-settings-account-value" id="stabit-settings-password-masked">••••••••</span>
              <button class="stabit-settings-eye" id="stabit-settings-eye-btn" aria-label="显示密码" title="显示密码">
                <svg class="stabit-settings-eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="stabit-settings-account-row stabit-settings-account-row-action">
            <span></span>
            <button class="stabit-settings-link-btn" id="stabit-settings-change-pwd-btn">修改密码</button>
          </div>
        </div>

        <!-- Change password inline state (hidden by default) -->
        <div class="stabit-settings-surface stabit-settings-change-pwd" id="stabit-settings-change-pwd" style="display:none;">
          <div class="stabit-settings-chg-title">修改密码</div>
          <div class="stabit-settings-chg-field">
            <label class="stabit-settings-chg-label">当前密码</label>
            <input type="password" class="stabit-settings-chg-input" id="stabit-settings-chg-current" autocomplete="current-password">
          </div>
          <div class="stabit-settings-chg-field">
            <label class="stabit-settings-chg-label">新密码</label>
            <input type="password" class="stabit-settings-chg-input" id="stabit-settings-chg-new" autocomplete="new-password">
          </div>
          <div class="stabit-settings-chg-field">
            <label class="stabit-settings-chg-label">确认新密码</label>
            <input type="password" class="stabit-settings-chg-input" id="stabit-settings-chg-confirm" autocomplete="new-password">
          </div>
          <div class="stabit-settings-chg-error" id="stabit-settings-chg-error" style="display:none;"></div>
          <div class="stabit-settings-chg-actions">
            <button class="stabit-settings-chg-cancel" id="stabit-settings-chg-cancel">取消</button>
            <button class="stabit-settings-chg-ok" id="stabit-settings-chg-ok">确认修改</button>
          </div>
        </div>

        <!-- Volume surface -->
        <div class="stabit-settings-surface">
          <div class="stabit-settings-surface-label">音乐音量</div>
          <div class="stabit-settings-volume">
            <input type="range" min="0" max="100" value="20" class="stabit-settings-slider" id="stabit-settings-volume-slider" aria-label="音乐音量">
            <span class="stabit-settings-volume-value" id="stabit-settings-volume-value">20%</span>
          </div>
        </div>

        <!-- Data surface -->
        <div class="stabit-settings-surface">
          <div class="stabit-settings-surface-label">数据</div>
          <div class="stabit-settings-danger">
            <button class="stabit-settings-reset-btn" id="stabit-settings-reset-btn">重置当前账户数据</button>
            <div class="stabit-settings-reset-desc">清除烦恼针、聊天记录和进度，以便重新测试。</div>
          </div>
        </div>

        <!-- Logout -->
        <div class="stabit-settings-logout">
          <button class="stabit-settings-logout-btn" id="stabit-settings-logout-btn">退出登录</button>
        </div>

      </div>

      <!-- Reset confirmation overlay -->
      <div class="stabit-settings-confirm" id="stabit-settings-confirm" style="display:none;">
        <div class="stabit-settings-confirm-text">确定要重置当前账户吗？</div>
        <div class="stabit-settings-confirm-sub">这会清除当前账户的烦恼针、聊天记录、回顾进度和陪伴天数。</div>
        <div class="stabit-settings-confirm-actions">
          <button class="stabit-settings-confirm-cancel" id="stabit-settings-confirm-cancel">取消</button>
          <button class="stabit-settings-confirm-ok" id="stabit-settings-confirm-ok">确认重置</button>
        </div>
      </div>

      <!-- Success toast (password changed) -->
      <div class="stabit-settings-toast" id="stabit-settings-toast" style="display:none;"></div>
    `;
  },

  // ── Event Wiring ──────────────────────────────────────

  _attachPanelListeners() {
    // Close
    this._panel.querySelector('.stabit-settings-close').addEventListener('click', () => this.close());

    // Eye toggle
    const eyeBtn = this._panel.querySelector('#stabit-settings-eye-btn');
    eyeBtn.addEventListener('click', () => this._togglePasswordVisibility());

    // Change password
    this._panel.querySelector('#stabit-settings-change-pwd-btn').addEventListener('click', () => this._openChangePassword());
    this._panel.querySelector('#stabit-settings-chg-cancel').addEventListener('click', () => this._closeChangePassword());
    this._panel.querySelector('#stabit-settings-chg-ok').addEventListener('click', () => this._submitChangePassword());

    // Volume
    const slider = this._panel.querySelector('#stabit-settings-volume-slider');
    const volValue = this._panel.querySelector('#stabit-settings-volume-value');
    slider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      volValue.textContent = pct + '%';
      this._applyVolume(pct);
    });

    // Reset
    this._panel.querySelector('#stabit-settings-reset-btn').addEventListener('click', () => this._showConfirm());
    this._panel.querySelector('#stabit-settings-confirm-cancel').addEventListener('click', () => this._hideConfirm());
    this._panel.querySelector('#stabit-settings-confirm-ok').addEventListener('click', () => {
      this._hideConfirm();
      this._performReset();
    });

    // Logout
    this._panel.querySelector('#stabit-settings-logout-btn').addEventListener('click', () => this._performLogout());
  },

  _attachKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        if (this._confirmVisible) {
          this._hideConfirm();
        } else if (this._changingPassword) {
          this._closeChangePassword();
        } else {
          this.close();
        }
      }
    });
  },

  // ── Open / Close ──────────────────────────────────────

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._populateAccount();
    this._populateVolume();
    this._overlay.classList.add('stabit-settings-open');
    this._overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('stabit-settings-noscroll');
  },

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._hideConfirm();
    this._closeChangePassword(true);
    this._passwordVisible = false;
    this._updatePasswordDisplay();
    this._overlay.classList.remove('stabit-settings-open');
    this._overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('stabit-settings-noscroll');
  },

  // ── Data Population ───────────────────────────────────

  _populateAccount() {
    const user = UserStorage.getCurrentUser();
    const nameEl = this._panel.querySelector('#stabit-settings-username');
    if (user && user.username) {
      nameEl.textContent = user.username;
    } else {
      nameEl.textContent = '—';
    }
    this._passwordVisible = false;
    this._updatePasswordDisplay();
  },

  _populateVolume() {
    const user = UserStorage.getCurrentUser();
    let pct = 20;
    if (user && user.settings && typeof user.settings.musicVolume === 'number') {
      pct = user.settings.musicVolume;
    } else if (AudioManager.bgm && typeof AudioManager.bgm.volume === 'number') {
      pct = Math.round(AudioManager.bgm.volume * 100);
    }
    const slider = this._panel.querySelector('#stabit-settings-volume-slider');
    const volValue = this._panel.querySelector('#stabit-settings-volume-value');
    slider.value = pct;
    volValue.textContent = pct + '%';
  },

  // ── Password Eye Toggle ────────────────────────────────

  _togglePasswordVisibility() {
    this._passwordVisible = !this._passwordVisible;
    this._updatePasswordDisplay();
    const eyeBtn = this._panel.querySelector('#stabit-settings-eye-btn');
    eyeBtn.setAttribute('aria-label', this._passwordVisible ? '隐藏密码' : '显示密码');
  },

  _updatePasswordDisplay() {
    const masked = this._panel.querySelector('#stabit-settings-password-masked');
    const user = UserStorage.getCurrentUser();
    if (this._passwordVisible && user && user.password) {
      masked.textContent = user.password;
    } else {
      masked.textContent = '••••••••';
    }
  },

  // ── Change Password ───────────────────────────────────

  _openChangePassword() {
    this._changingPassword = true;
    const panel = this._panel.querySelector('#stabit-settings-change-pwd');
    const mainSurfaces = this._panel.querySelectorAll('.stabit-settings-surface:not(.stabit-settings-change-pwd)');
    const logout = this._panel.querySelector('.stabit-settings-logout');
    mainSurfaces.forEach(s => s.style.display = 'none');
    if (logout) logout.style.display = 'none';
    panel.style.display = 'flex';
    // Auto-focus current password
    setTimeout(() => {
      const el = this._panel.querySelector('#stabit-settings-chg-current');
      if (el) el.focus();
    }, 150);
  },

  _closeChangePassword(silent) {
    if (!this._changingPassword) return;
    this._changingPassword = false;
    const panel = this._panel.querySelector('#stabit-settings-change-pwd');
    const mainSurfaces = this._panel.querySelectorAll('.stabit-settings-surface:not(.stabit-settings-change-pwd)');
    const logout = this._panel.querySelector('.stabit-settings-logout');
    panel.style.display = 'none';
    mainSurfaces.forEach(s => s.style.display = '');
    if (logout) logout.style.display = '';
    // Clear inputs
    this._panel.querySelector('#stabit-settings-chg-current').value = '';
    this._panel.querySelector('#stabit-settings-chg-new').value = '';
    this._panel.querySelector('#stabit-settings-chg-confirm').value = '';
    this._hideChgError();
    if (!silent) this._hideToast();
  },

  _submitChangePassword() {
    const user = UserStorage.getCurrentUser();
    if (!user) return;

    const current = this._panel.querySelector('#stabit-settings-chg-current').value;
    const newPwd = this._panel.querySelector('#stabit-settings-chg-new').value;
    const confirm = this._panel.querySelector('#stabit-settings-chg-confirm').value;

    if (current !== user.password) {
      return this._showChgError('当前密码不正确');
    }
    if (!newPwd) {
      return this._showChgError('新密码不能为空');
    }
    if (newPwd !== confirm) {
      return this._showChgError('两次输入的新密码不一致');
    }
    if (newPwd === current) {
      return this._showChgError('新密码不能与当前密码相同');
    }

    // Update via storage
    UserStorage.changePassword(user.username, newPwd);

    // Refresh cached state so the eye reveals the NEW password next time
    this._passwordVisible = false;
    this._populateAccount();

    this._closeChangePassword(true);
    this._showToast('密码已更新');
  },

  _showChgError(msg) {
    const el = this._panel.querySelector('#stabit-settings-chg-error');
    el.textContent = msg;
    el.style.display = 'block';
  },

  _hideChgError() {
    const el = this._panel.querySelector('#stabit-settings-chg-error');
    el.style.display = 'none';
    el.textContent = '';
  },

  _showToast(msg) {
    const toast = this._panel.querySelector('#stabit-settings-toast');
    toast.textContent = msg;
    toast.classList.add('stabit-settings-toast-show');
    toast.style.display = 'block';
    setTimeout(() => {
      toast.classList.remove('stabit-settings-toast-show');
      setTimeout(() => { toast.style.display = 'none'; }, 200);
    }, 1800);
  },

  _hideToast() {
    const toast = this._panel.querySelector('#stabit-settings-toast');
    toast.classList.remove('stabit-settings-toast-show');
  },

  // ── Volume Control ────────────────────────────────────

  _applyVolume(pct) {
    const volume = Math.max(0, Math.min(1, pct / 100));
    if (AudioManager.bgm) {
      AudioManager.bgm.volume = volume;
    }
    const user = UserStorage.getCurrentUser();
    if (user) {
      if (!user.settings) user.settings = {};
      user.settings.musicVolume = pct;
      UserStorage.updateUser(user);
      UserStorage.setCurrentUser(user.username);
    }
    if (DEV_MODE) console.log('[SETTINGS] volume set to', pct + '%');
  },

  // ── Reset Confirmation ────────────────────────────────

  _showConfirm() {
    this._confirmVisible = true;
    this._panel.querySelector('#stabit-settings-confirm').style.display = 'flex';
  },

  _hideConfirm() {
    this._confirmVisible = false;
    this._panel.querySelector('#stabit-settings-confirm').style.display = 'none';
  },

  // ── Reset Logic ───────────────────────────────────────

  _performReset() {
    const user = UserStorage.getCurrentUser();
    if (!user) return;

    const username = user.username;
    const password = user.password;
    const createdAt = user.createdAt;
    const settings = user.settings || {};

    user.painPins = [];
    user.resolvedPins = [];
    user.chatHistory = [];
    user.companionDays = 1;
    user.firstCompanionDate = Date.now();
    user.activePinId = null;
    user.reviewingPinId = null;
    user.pendingAction = null;
    user.pendingReviewAction = null;
    user.showReviewShortcut = false;
    user.progression = {};

    user.username = username;
    user.password = password;
    user.createdAt = createdAt;
    user.settings = settings;

    UserStorage.updateUser(user);
    UserStorage.setCurrentUser(username);

    if (DEV_MODE) console.log('[SETTINGS] account reset:', username);

    this.close();
    window.reviewingPinId = null;
    window.activePinId = null;
    window.STABIT_CHAT_MODE = null;
    window.STABIT_MODE = null;
    if (typeof showHomeScreen === 'function') showHomeScreen();
  },

  // ── Logout ────────────────────────────────────────────

  _performLogout() {
    this.close();
    UserStorage.logout();
    window.reviewingPinId = null;
    window.activePinId = null;
    window.STABIT_CHAT_MODE = null;
    window.STABIT_MODE = null;
    if (typeof showAuthScreen === 'function') showAuthScreen();
    if (DEV_MODE) console.log('[SETTINGS] user logged out');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  StabItSettings.init();
});
