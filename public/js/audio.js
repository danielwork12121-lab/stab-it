const AudioManager = {
  bgm: null,
  impactAudio: null,
  celebrationAudio: null,
  bgmStarted: false,
  isUnlocked: false,
  lastCelebrationPlay: 0,
  _unlockListenersAttached: false,
  _unlockAttemptInFlight: false,

  initAudio() {
    try {
      this.bgm = new Audio(ASSETS.backgroundMusic);
      this.bgm.loop = true;
      this.bgm.volume = 0.2;
      
      this.impactAudio = new Audio(ASSETS.pinImpactSound);
      this.impactAudio.volume = 1.0;

      this.celebrationAudio = new Audio(ASSETS.celebrationSound);
      this.celebrationAudio.volume = 0.7;
      
      this.bgm.addEventListener('error', (e) => {
        if (DEV_MODE) console.error('[AUDIO] BGM load error:', e);
      });
      
      this.impactAudio.addEventListener('error', (e) => {
        if (DEV_MODE) console.error('[AUDIO] Impact sound load error:', e);
      });

      this.celebrationAudio.addEventListener('error', (e) => {
        if (DEV_MODE) console.error('[AUDIO] Celebration sound load error:', e);
      });

      this.bgm.play().then(() => {
        this.bgmStarted = true;
        if (DEV_MODE) {
          console.log('[AUDIO] BGM autoplay succeeded');
        }
      }).catch((err) => {
        if (DEV_MODE) {
          console.warn('[AUDIO] BGM autoplay blocked:', err.name || err.message);
        }
        this.setupUnlockListeners();
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.bgm && this.bgmStarted && this.bgm.paused) {
          this.bgm.play().catch(() => {});
        }
      });
      
      if (DEV_MODE) {
        console.log('[AUDIO] initialized');
      }
    } catch (err) {
      if (DEV_MODE) {
        console.error('[AUDIO] init failed:', err.message);
      }
    }
  },

  // Browser autoplay policy blocks bgm.play() until a real user gesture.
    // The Audio element itself can be created anywhere; the constraint is the
    // play() permission and the retry path after autoplay is denied.
    // One physical tap fires pointerdown/touchstart/click in sequence, so
    // _unlockAttemptInFlight prevents concurrent play() calls.
    setupUnlockListeners() {
    if (this._unlockListenersAttached) return;
    this._unlockListenersAttached = true;

    const tryPlay = (e) => {
      if (!this.bgm || this.bgmStarted) {
        this._removeUnlockListeners();
        return;
      }

      if (this._unlockAttemptInFlight) {
        if (DEV_MODE) {
          console.log('[AUDIO] unlock attempt in-flight, skipping duplicate gesture');
        }
        return;
      }

      if (DEV_MODE) {
        console.log('[AUDIO] unlock gesture:', e.type);
      }

      this._unlockAttemptInFlight = true;

      this.bgm.play().then(() => {
        this._unlockAttemptInFlight = false;
        this.bgmStarted = true;
        this.isUnlocked = true;
        this._removeUnlockListeners();
        if (DEV_MODE) {
          console.log('[AUDIO] BGM unlocked successfully');
        }
      }).catch((err) => {
        this._unlockAttemptInFlight = false;
        if (DEV_MODE) {
          console.warn('[AUDIO] unlock retry failed:', err.name || err.message);
        }
      });
    };

    this._unlockHandler = tryPlay;

    document.addEventListener('pointerdown', tryPlay);
    document.addEventListener('touchstart', tryPlay);
    document.addEventListener('click', tryPlay);
    document.addEventListener('keydown', tryPlay);

    if (DEV_MODE) {
      console.log('[AUDIO] audio unlock listeners attached');
    }
  },

  _removeUnlockListeners() {
    if (!this._unlockHandler) return;
    document.removeEventListener('pointerdown', this._unlockHandler);
    document.removeEventListener('touchstart', this._unlockHandler);
    document.removeEventListener('click', this._unlockHandler);
    document.removeEventListener('keydown', this._unlockHandler);
    this._unlockHandler = null;
    this._unlockListenersAttached = false;
  },

  startBackgroundMusic() {
    if (this.bgmStarted || !this.bgm) {
      if (DEV_MODE && !this.bgm) console.warn('[AUDIO] bg play attempted - bgm is null');
      return;
    }

    if (DEV_MODE) {
      console.log('[AUDIO] bg play attempted');
    }

    this.bgm.play().then(() => {
      this.bgmStarted = true;
      if (DEV_MODE) {
        console.log('[AUDIO] bg play success');
      }
    }).catch((err) => {
      if (DEV_MODE) {
        console.warn('[AUDIO] bg play fail:', err.name || err.message);
      }
      if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
        this.setupUnlockListeners();
      }
    });
  },

  playPinImpactSound() {
    if (!this.impactAudio) {
      if (DEV_MODE) console.warn('[AUDIO] impact play attempted - audio is null');
      return;
    }
    
    this.impactAudio.currentTime = 0;
    this.impactAudio.play().then(() => {
      if (DEV_MODE) {
        console.log('[AUDIO] Pin impact sound played');
      }
    }).catch((err) => {
      if (DEV_MODE) {
        console.warn('[AUDIO] Pin impact sound failed:', err.message);
      }
    });
  },

  playCelebrationSound() {
    if (!this.celebrationAudio) {
      if (DEV_MODE) console.warn('[AUDIO] celebration play attempted - audio is null');
      return;
    }

    const now = Date.now();
    if (now - this.lastCelebrationPlay < 1000) {
      if (DEV_MODE) console.warn('[AUDIO] celebration sound debounced');
      return;
    }
    this.lastCelebrationPlay = now;

    this.celebrationAudio.currentTime = 0;
    this.celebrationAudio.play().then(() => {
      if (DEV_MODE) console.log('[CELEBRATION AUDIO DEBUG] celebration sound played with confetti');
    }).catch((err) => {
      if (DEV_MODE) console.warn('[AUDIO] Celebration sound failed:', err.message);
    });
  }
};

function initAudio() {
  AudioManager.initAudio();
}

function startBackgroundMusic() {
  AudioManager.startBackgroundMusic();
}

function playPinImpactSound() {
  AudioManager.playPinImpactSound();
}