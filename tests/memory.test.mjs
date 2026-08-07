/**
 * Memory V1 — Focused similarity tests.
 *
 * Tests the REAL StabItMemory object from public/js/memory.js
 * by evaluating the source in a controlled context.
 *
 * Run: node tests/memory.test.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const memorySrc = readFileSync(join(__dirname, '..', 'public', 'js', 'memory.js'), 'utf8');

// Evaluate memory.js in a sandbox-like context with mocked DEV_MODE
// ESM strict mode prevents eval from leaking variables, so use new Function
const wrappedSrc = memorySrc + '\nreturn { StabItMemory, buildMemoryContext, clearMemoryCache };';
const factory = new Function('DEV_MODE', 'console', wrappedSrc);
const { StabItMemory, buildMemoryContext, clearMemoryCache } = factory(false, console);

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error('  FAIL:', label);
  }
}

function assertEq(actual, expected, label) {
  assert(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

console.log('=== Memory V1 Similarity Test Harness ===\n');

// Helper: clear cache between tests to prevent cross-test contamination
function resetCache() { StabItMemory.clearCache(); }

// ── 1. No pins → no memory context ──
resetCache();
{
  const result = StabItMemory.buildMemoryContext(null, null, '我老师骂我', 'pinning');
  assertEq(result, null, 'No pins → null');
}

{
  const result = StabItMemory.buildMemoryContext({ painPins: [], resolvedPins: [] }, 'pin1', '我老师骂我', 'pinning');
  assertEq(result, null, 'Empty pins → null');
}

// ── 2. Greeting/vague → no memory ──
resetCache();
{
  const user = {
    painPins: [{ id: 'p1', coreIssue: '被老师批评后感到难受', createdAt: 1 }],
    resolvedPins: []
  };
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '你好', 'pinning'), null, '你好 → null');
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '有点烦', 'pinning'), null, '有点烦 → null');
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '不开心', 'pinning'), null, '不开心 → null');
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '嗨', 'pinning'), null, '嗨 → null');
}

// ── 3. Review mode → no memory (V1 pinning only) ──
resetCache();
{
  const user = {
    painPins: [{ id: 'p1', coreIssue: '被老师批评后感到难受', createdAt: 1 }],
    resolvedPins: []
  };
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '我老师骂我', 'review'), null, 'Review mode → null');
}

// ── 4. Strong match: old "朋友很久没回消息" + current "女朋友一直没回我" ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ],
    resolvedPins: []
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '女朋友一直没回我', 'pinning');
  assert(result !== null, 'Strong match: 朋友没回消息 ↔ 女朋友没回我 → non-null');
  assert(result.includes('朋友很久没回消息'), 'Memory context contains old coreIssue');
  assert(result.includes('规则'), 'Memory context contains fact-boundary rules');
}

// ── 5. Unrelated issue → no match ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '考试没考好压力很大', createdAt: 1 },
    ],
    resolvedPins: []
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '我和朋友吵架了', 'pinning');
  // These should have low overlap: 考试/学习 vs 朋友/争吵
  // Bigrams: 考试/试没/没考/考好/好压/压力/力很/很大 vs 我和/和朋/朋友/友吵/吵架/架了
  // No overlap expected
  assertEq(result, null, 'Unrelated: 考试压力 vs 朋友吵架 → null');
}

// ── 6. Max 2 matches ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
      { id: 'p2', coreIssue: '女朋友不回我消息很焦虑', createdAt: 2 },
      { id: 'p3', coreIssue: '室友不回消息我很担心', createdAt: 3 },
    ],
    resolvedPins: []
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '女朋友一直没回我', 'pinning');
  assert(result !== null, '3 matching pins → non-null');
  // Count numbered lines (1. and 2.)
  const matchCount = (result.match(/^\d+\./gm) || []).length;
  assert(matchCount <= 2, `Max 2 matches (got ${matchCount})`);
  assert(matchCount === 2, `Exactly 2 matches for 3 matching pins (got ${matchCount})`);
}

// ── 7. Current pin excluded ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'current', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
      { id: 'p2', coreIssue: '另一个完全不同的问题关于工作压力', createdAt: 2 },
    ],
    resolvedPins: []
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '朋友很久没回我消息', 'pinning');
  // Current pin should be excluded; only p2 remains, which has no overlap
  assertEq(result, null, 'Current pin excluded (only non-matching pin remains)');
}

// ── 8. Resolved pins included ──
resetCache();
{
  const user = {
    painPins: [],
    resolvedPins: [
      { id: 'r1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ]
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '女朋友一直没回我', 'pinning');
  assert(result !== null, 'Resolved pin can match');
  assert(result.includes('已释怀'), 'Resolved pin shows status label');
}

// ── 9. Session cache: same pin reuses memory ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ],
    resolvedPins: []
  };
  // First call builds and caches
  const result1 = StabItMemory.buildMemoryContext(user, 'cached_pin', '女朋友一直没回我', 'pinning');
  // Second call with different text should return SAME cached result
  const result2 = StabItMemory.buildMemoryContext(user, 'cached_pin', '完全不同的一句话', 'pinning');
  assert(result1 === result2, 'Session cache: same pin returns cached memory even with different text');
  // Clear cache
  StabItMemory.clearCache();
  // After clear, different text should produce different result
  const result3 = StabItMemory.buildMemoryContext(user, 'cached_pin', '完全不同的一句话', 'pinning');
  assert(result3 === null, 'After clearCache, non-matching text → null');
}

// ── 10. Pins without coreIssue are skipped ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '', createdAt: 1 },
      { id: 'p2', coreIssue: null, createdAt: 2 },
      { id: 'p3', coreIssue: '   ', createdAt: 3 },
    ],
    resolvedPins: []
  };
  assertEq(StabItMemory.buildMemoryContext(user, 'current', '我老师骂我', 'pinning'), null, 'Pins with empty coreIssue → null');
}

// ── 11. Fact-boundary rules present in context ──
resetCache();
{
  const user = {
    painPins: [
      { id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ],
    resolvedPins: []
  };
  const result = StabItMemory.buildMemoryContext(user, 'current', '女朋友一直没回我', 'pinning');
  assert(result.includes('不要假设过去和现在原因相同'), 'Fact boundary: past ≠ current cause');
  assert(result.includes('不要根据旧记录推断'), 'Fact boundary: no inferring unstated feelings');
  assert(result.includes('可以完全不提'), 'Fact boundary: AI may ignore memories');
  assert(result.includes('不要说"系统发现"'), 'Fact boundary: no internal mechanics');
}

// ── 12. Similarity helper unit tests ──
resetCache();
{
  const score1 = StabItMemory._calculateSimilarity('朋友很久没回消息', '女朋友一直没回我');
  assert(score1 > 0, `Similarity(朋友没回消息, 女朋友没回我) > 0 (got ${score1.toFixed(3)})`);

  const score2 = StabItMemory._calculateSimilarity('考试压力很大', '和朋友吵架了');
  assert(score2 < 0.15, `Similarity(考试压力, 朋友吵架) < 0.15 (got ${score2.toFixed(3)})`);

  const score3 = StabItMemory._calculateSimilarity('', 'anything');
  assertEq(score3, 0, 'Empty text → 0 similarity');
}

// ── 13. buildMemoryContext global function ──
resetCache();
{
  const user = {
    painPins: [{ id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 }],
    resolvedPins: []
  };
  const result = buildMemoryContext(user, 'current', '女朋友一直没回我', 'pinning');
  assert(result !== null, 'Global buildMemoryContext() works');
}

// ── 14. Vague→Concrete: null result must NOT be cached ──
// Scenario: same pin/session.
//   "今天有点烦" → null (vague/non-matching)
//   "我朋友一直不回我消息" → lookup MUST run now (not cached as null)
resetCache();
{
  const user = {
    username: 'alice',
    painPins: [
      { id: 'p1', coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ],
    resolvedPins: []
  };

  // Step 1: vague/non-matching text → must return null
  const result1 = StabItMemory.buildMemoryContext(user, 'currentPin', '今天有点烦', 'pinning');
  assertEq(result1, null, 'Vague→Concrete: "今天有点烦" → null');

  // Verify null was NOT cached: cache should not have the key
  assert(!StabItMemory._sessionCache.has('alice:currentPin'), 'Vague→Concrete: null result NOT cached (no cache entry)');

  // Step 2: concrete matching text → lookup MUST run and return non-null
  const result2 = StabItMemory.buildMemoryContext(user, 'currentPin', '我朋友一直不回我消息', 'pinning');
  assert(result2 !== null, 'Vague→Concrete: "我朋友一直不回我消息" → non-null (lookup ran, not blocked by prior null)');
  assert(result2.includes('朋友很久没回消息'), 'Vague→Concrete: concrete match contains old coreIssue');
}

// ── 15. Cross-account cache isolation ──
// Scenario: User A and User B have the SAME pinId.
// User B must NOT receive User A's cached context.
resetCache();
{
  const sharedPinId = 'pin_123';

  const userA = {
    username: 'alice',
    painPins: [
      { id: sharedPinId, coreIssue: '朋友很久没回消息让我不安', createdAt: 1 },
    ],
    resolvedPins: []
  };
  const userB = {
    username: 'bob',
    painPins: [
      { id: sharedPinId, coreIssue: '考试没考好压力很大', createdAt: 1 },
    ],
    resolvedPins: []
  };

  // User A: matching text → builds and caches context under "alice:current_new"
  const resultA = StabItMemory.buildMemoryContext(userA, 'current_new', '女朋友一直没回我', 'pinning');
  assert(resultA !== null, 'Cross-account: User A match → non-null');
  assert(resultA.includes('朋友很久没回消息'), 'Cross-account: User A context is alice\'s');

  // Direct cache inspection: only alice's key exists, not bob's
  assert(StabItMemory._sessionCache.has('alice:current_new'), 'Cross-account: cache has alice key');
  assert(!StabItMemory._sessionCache.has('bob:current_new'), 'Cross-account: cache does NOT have bob key');

  // User B: same currentPinId, same text, but different username
  // User B's pin is about 考试, not about 没回消息 → should be null (no leak)
  const resultB = StabItMemory.buildMemoryContext(userB, 'current_new', '女朋友一直没回我', 'pinning');
  assertEq(resultB, null, 'Cross-account: User B does NOT receive User A\'s cached context');

  // User B: matching text for their OWN pin → should match independently
  const resultB2 = StabItMemory.buildMemoryContext(userB, 'current_new', '考试没考好怎么办', 'pinning');
  assert(resultB2 !== null, 'Cross-account: User B matches own pin');
  assert(resultB2.includes('考试'), 'Cross-account: User B context is bob\'s');
  assert(!resultB2.includes('朋友很久没回消息'), 'Cross-account: no leakage from alice into bob');
}

// ── Summary ──
console.log(`\n${'='.repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  -', f));
  process.exit(1);
} else {
  console.log('All memory tests passed.');
}
