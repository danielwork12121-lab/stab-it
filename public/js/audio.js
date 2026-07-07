const AudioManager = {
  bgm: null,
  impactAudio: null,
  bgmStarted: false,
  isUnlocked: false,

  initAudio() {
    try {
      this.bgm = new Audio(ASSETS.backgroundMusic);
      this.bgm.loop = true;
      this.bgm.volume = 0.22;
      
      this.impactAudio = new Audio(ASSETS.pinImpactSound);
      this.impactAudio.volume = 0.75;
      
      this.bgm.addEventListener('error', (e) => {
        if (DEV_MODE) console.error('[AUDIO] BGM load error:', e);
      });
      
      this.impactAudio.addEventListener('error', (e) => {
        if (DEV_MODE) console.error('[AUDIO] Impact sound load error:', e);
      });
      
      this.setupUnlockListeners();
      
      if (DEV_MODE) {
        console.log('[AUDIO] initialized');
      }
    } catch (err) {
      if (DEV_MODE) {
        console.error('[AUDIO] init failed:', err.message);
      }
    }
  },

  setupUnlockListeners() {
    const unlock = (e) => {
      if (this.isUnlocked) return;
      
      this.isUnlocked = true;
      
      if (DEV_MODE) {
        console.log('[AUDIO] first gesture detected:', e.type);
      }
      
      this.startBackgroundMusic();
      
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  },

  startBackgroundMusic() {
    if (this.bgmStarted || !this.bgm) {
      if (DEV_MODE && !this.bgm) console.warn('[AUDIO] bg play attempted - bgm is null');
      return;
    }
    
    this.bgmStarted = true;
    
    if (DEV_MODE) {
      console.log('[AUDIO] bg play attempted');
    }
    
    this.bgm.play().then(() => {
      if (DEV_MODE) {
        console.log('[AUDIO] bg play success');
      }
    }).catch((err) => {
      if (DEV_MODE) {
        console.warn('[AUDIO] bg play fail:', err.message);
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