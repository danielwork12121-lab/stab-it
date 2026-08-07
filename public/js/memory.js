/**
 * StabIt V1 Centralized Memory — local deterministic similarity.
 * Derives compact memory context from existing user pins.
 * No ML, no embedding, no extra API calls.
 */
const StabItMemory = {
  // Module-level cache: pinId → memoryContextString
  // Transient runtime state, cleared on reload/logout.
  _sessionCache: new Map(),

  // Small curated synonym/theme groups for Chinese keyword matching.
  // Each group: words that should be treated as semantically related.
  _THEME_GROUPS: [
    ['争吵', '吵架', '冲突', '矛盾', '争执', '吵架了'],
    ['回复', '不回消息', '没回', '不回我', '消息', '已读不回'],
    ['批评', '责骂', '骂', '批评了', '被骂', '训'],
    ['考试', '学习', '成绩', '作业', '考', '挂科', '复习'],
    ['朋友', '室友', '伴侣', '同学', '同事', '女朋友', '男朋友'],
    ['压力', '焦虑', '紧张', '担心', '害怕', '不安'],
    ['工作', '加班', '老板', '上司', '项目', 'deadline'],
    ['孤独', '寂寞', '一个人', '没人陪', '孤立'],
  ],

  /**
   * Normalize text for comparison: lowercase, trim, remove common punctuation.
   */
  _normalize(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[，。！？、；：""''（）【】《》\,\.\!\?\;\:\"\'\(\)\[\]<>…\s]+/g, ' ')
      .trim();
  },

  /**
   * Extract meaningful keywords from Chinese text.
   * Uses character bigrams + canonical theme detection.
   * Theme group synonyms are canonicalized to a shared theme ID
   * so "没回" and "不回消息" count as the same semantic signal.
   */
  _extractKeywords(text) {
    const normalized = this._normalize(text);
    if (!normalized) return new Set();

    const keywords = new Set();

    // 1. Check for theme group words — canonicalize to shared theme ID
    for (let gi = 0; gi < this._THEME_GROUPS.length; gi++) {
      const group = this._THEME_GROUPS[gi];
      let matched = false;
      for (const word of group) {
        if (normalized.includes(word)) {
          matched = true;
          break;
        }
      }
      if (matched) {
        keywords.add(`theme:${gi}`);
      }
    }

    // 2. Extract 2-character bigrams from the normalized text
    const chars = normalized.replace(/\s+/g, '');
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars.slice(i, i + 2);
      // Skip pure number/punctuation bigrams
      if (!/^[\u4e00-\u9fa5a-z]{2}$/.test(bigram)) continue;
      keywords.add(bigram);
    }

    return keywords;
  },

  /**
   * Check if text is too vague/generic to warrant memory lookup.
   */
  _isTooVague(text) {
    const normalized = this._normalize(text);
    if (!normalized || normalized.length < 4) return true;

    const vaguePatterns = [
      '你好', '嗨', '在吗', '有人吗', '你好呀', '哈喽',
      '有点烦', '不开心', '难受', '心情不好', '不太好',
      '今天', '最近', '有点', '感觉', '不知道',
    ];

    for (const pattern of vaguePatterns) {
      if (normalized === pattern) return true;
    }

    // If text is only vague words with no concrete content
    const keywords = this._extractKeywords(text);
    if (keywords.size === 0) return true;

    return false;
  },

  /**
   * Calculate similarity score between two texts (0-1).
   * Based on keyword overlap (Jaccard-like).
   */
  _calculateSimilarity(text1, text2) {
    const kw1 = this._extractKeywords(text1);
    const kw2 = this._extractKeywords(text2);

    if (kw1.size === 0 || kw2.size === 0) return 0;

    let intersection = 0;
    for (const kw of kw1) {
      if (kw2.has(kw)) intersection++;
    }

    const union = kw1.size + kw2.size - intersection;
    return union > 0 ? intersection / union : 0;
  },

  /**
   * Build compact memory items from user's pins (excluding current pin).
   * Returns array of { pinId, coreIssue, status, createdAt }.
   */
  _buildMemoryItems(currentUser, currentPinId) {
    if (!currentUser) return [];

    const items = [];

    // Active pain pins (excluding current)
    if (Array.isArray(currentUser.painPins)) {
      for (const pin of currentUser.painPins) {
        if (pin.id === currentPinId) continue;
        if (!pin.coreIssue || !pin.coreIssue.trim()) continue;
        items.push({
          pinId: pin.id,
          coreIssue: pin.coreIssue.trim(),
          status: 'active',
          createdAt: pin.createdAt || 0,
        });
      }
    }

    // Resolved pins
    if (Array.isArray(currentUser.resolvedPins)) {
      for (const pin of currentUser.resolvedPins) {
        if (pin.id === currentPinId) continue;
        if (!pin.coreIssue || !pin.coreIssue.trim()) continue;
        items.push({
          pinId: pin.id,
          coreIssue: pin.coreIssue.trim(),
          status: 'resolved',
          createdAt: pin.createdAt || 0,
        });
      }
    }

    return items;
  },

  /**
   * Find top matching memory items for the given text.
   * Returns max 2 strong matches.
   */
  _findMatches(memoryItems, text, threshold = 0.10) {
    if (!memoryItems || memoryItems.length === 0) return [];

    const scored = memoryItems.map(item => ({
      ...item,
      score: this._calculateSimilarity(text, item.coreIssue),
    }));

    // Filter by threshold, sort by score descending
    const matches = scored
      .filter(m => m.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return matches;
  },

  /**
   * Format memory matches into a short context string for the AI.
   * Returns null if no matches or invalid input.
   */
  _formatMemoryContext(matches) {
    if (!matches || matches.length === 0) return null;

    const lines = matches.map((m, i) => {
      const statusLabel = m.status === 'resolved' ? '（已释怀）' : '';
      return `${i + 1}. ${m.coreIssue}${statusLabel}`;
    });

    return `可能相关的过去记录，仅作为背景：\n${lines.join('\n')}\n\n规则：\n- 当前用户这次说的话永远优先\n- 不要假设过去和现在原因相同\n- 不要根据旧记录推断当前用户没说过的感受/动机\n- 只有确实有帮助时才自然提到相似之处\n- 可以完全不提这些记忆\n- 不要说"系统发现""匹配结果"等内部机制`;
  },

  /**
   * Clear session cache (called on logout, reset, etc).
   */
  clearCache() {
    this._sessionCache.clear();
  },

  /**
   * Main entry: build memory context for the current AI request.
   *
   * @param {Object} currentUser - from UserStorage.getCurrentUser()
   * @param {string} currentPinId - ID of the current pin (excluded from matches)
   * @param {string} userText - the user's latest message
   * @param {string} mode - 'pinning' or 'review'
   * @returns {string|null} - memory context string, or null if no memory
   */
  buildMemoryContext(currentUser, currentPinId, userText, mode) {
    // V1: pinning mode only
    if (mode !== 'pinning') return null;

    // Skip for greetings/vague input
    if (this._isTooVague(userText)) return null;

    // Build cache key scoped by username to prevent cross-account leakage
    const username = currentUser?.username || '_anon';
    const cacheKey = currentPinId ? `${username}:${currentPinId}` : null;

    // Check session cache for this pin
    if (cacheKey && this._sessionCache.has(cacheKey)) {
      return this._sessionCache.get(cacheKey);
    }

    // Build memory items from existing pins
    const memoryItems = this._buildMemoryItems(currentUser, currentPinId);
    if (memoryItems.length === 0) return null;

    // Find matches
    const matches = this._findMatches(memoryItems, userText);
    if (matches.length === 0) return null;

    // Format context
    const context = this._formatMemoryContext(matches);

    // Cache for this pin session (only actual context, never null)
    if (cacheKey && context) {
      this._sessionCache.set(cacheKey, context);
    }

    if (DEV_MODE) {
      console.log('[MEMORY] context built:', matches.length, 'matches, score:', matches.map(m => m.score.toFixed(2)).join(', '));
    }

    return context;
  },
};

// Expose for global access
function buildMemoryContext(currentUser, currentPinId, userText, mode) {
  return StabItMemory.buildMemoryContext(currentUser, currentPinId, userText, mode);
}

function clearMemoryCache() {
  StabItMemory.clearCache();
}
