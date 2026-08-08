const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';

// ── AI Reliability & Observability config ──────────────────────────────
const AI_DEBUG = process.env.AI_DEBUG === 'true';

// Function max duration (milliseconds).
// CONFIRMED: none — Vercel/Netlify dashboard plan limits are not code-readable.
// This is an explicit application env var. Set it to match your hosting plan's
// configured function timeout. If absent, a conservative DEFAULT is used.
const AI_FUNCTION_MAX_DURATION_MS = (() => {
  const v = parseInt(process.env.AI_FUNCTION_MAX_DURATION_MS, 10);
  if (!isNaN(v) && v >= 10000 && v <= 900000) return v;
  // DEFAULT (not detected truth): conservative 60s covers most Vercel plans.
  // Set AI_FUNCTION_MAX_DURATION_MS explicitly to enable longer budgets.
  return 60000;
})();

// Reserve time for parsing, fallback construction, and sending response.
// Configurable; default 10s.
const RESPONSE_RESERVE_MS = (() => {
  const v = parseInt(process.env.AI_RESPONSE_RESERVE_MS, 10);
  if (!isNaN(v) && v >= 1000 && v <= 60000) return v;
  return 10000;
})();

// Total AI budget = function max duration minus reserve (clamped to safe minimum).
// When AI_FUNCTION_MAX_DURATION_MS >= 120000, preferred budget is 100–110s.
const AI_TOTAL_BUDGET_MS = (() => {
  const v = parseInt(process.env.AI_TOTAL_BUDGET_MS, 10);
  if (!isNaN(v) && v >= 15000 && v <= AI_FUNCTION_MAX_DURATION_MS) return v;
  const budget = AI_FUNCTION_MAX_DURATION_MS - RESPONSE_RESERVE_MS;
  // Preferred generous budget when runtime safely supports it
  if (AI_FUNCTION_MAX_DURATION_MS >= 120000) return Math.min(110000, budget);
  return Math.max(15000, budget);
})();

// First-attempt timeout. Configurable; preferred 75–85s when budget allows.
const AI_FIRST_ATTEMPT_TIMEOUT_MS = (() => {
  const v = parseInt(process.env.AI_FIRST_ATTEMPT_TIMEOUT_MS, 10);
  if (!isNaN(v) && v >= 5000 && v <= AI_TOTAL_BUDGET_MS) return v;
  if (AI_TOTAL_BUDGET_MS >= 90000) return Math.min(85000, Math.floor(AI_TOTAL_BUDGET_MS * 0.75));
  return Math.floor(AI_TOTAL_BUDGET_MS * 0.7);
})();

// Minimum remaining time required before launching a retry.
const AI_RETRY_MIN_REMAINING_MS = (() => {
  const v = parseInt(process.env.AI_RETRY_MIN_REMAINING_MS, 10);
  if (!isNaN(v) && v >= 5000 && v <= 60000) return v;
  return 20000;
})();

// ── Production-safe logging (allowlist-only) ───────────────────────────
// Only approved primitive fields are ever emitted. No request bodies,
// provider responses, messages, prompts, errors with raw payloads, or
// nested objects reach production logs.
const AI_LOG_ALLOWLIST = new Set([
  'requestId', 'id', 'mode', 'provider', 'fallbackProvider', 'attempt', 'status',
  'durationMs', 'outcome', 'errorType', 'remainingMs', 'timeoutMs',
  'valid', 'usedFallback', 'budgetMs', 'messagesCount', 'extracted',
  'previous', 'rawReason'
]);

function aiLog(level, msg, ctx = {}) {
  const prefix = `[AI ${level.toUpperCase()}]`;
  if (AI_DEBUG) {
    // In debug mode, emit only allowlisted primitive fields
    const safeCtx = {};
    for (const [key, value] of Object.entries(ctx)) {
      if (AI_LOG_ALLOWLIST.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        safeCtx[key] = value;
      }
    }
    console.log(prefix, msg, safeCtx);
  } else {
    // In production, log only the summary line
    console.log(prefix, msg);
  }
}

// ── Request ID generation ──────────────────────────────────────────────
function generateRequestId() {
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

// ── Typed failure classification ───────────────────────────────────────
function classifyFallbackReason(rawReason) {
  if (!rawReason || typeof rawReason !== 'string') return 'validation_failure';
  const r = rawReason.toLowerCase();
  if (r.includes('timeout') || r.includes('aborterror') || r.includes('abort')) return 'provider_timeout';
  if (r.includes('429') || r.includes('rate_limited') || r.includes('rate limit')) return 'provider_rate_limited';
  if (r.includes('401') || r.includes('403') || r.includes('auth') || r.includes('unauthorized') || r.includes('forbidden')) return 'provider_auth_error';
  if (r.includes('402') || r.includes('balance') || r.includes('insufficient_quota') || r.includes('quota')) return 'provider_balance_error';
  if (r.includes('econn') || r.includes('network') || r.includes('enotfound') || r.includes('econnreset')) return 'network_error';
  if (r.includes('500') || r.includes('502') || r.includes('503') || r.includes('504') || r.includes('http_5')) return 'provider_http_error';
  if (r.includes('missing_api_key') || r.includes('missing_model') || r.includes('missing_content') || r.includes('missing_output') || r.includes('missing_structured')) return 'missing_structured_output';
  if (r.includes('invalid_response') || r.includes('invalid_structured') || r.includes('tool_call')) return 'invalid_structured_output';
  if (r.includes('retry_failed')) return 'validation_failure';
  if (r.includes('exception')) return 'server_exception';
  return 'validation_failure';
}

// Determine if a failure reason is retryable
function isRetryableReason(rawReason) {
  const typed = classifyFallbackReason(rawReason);
  return [
    'provider_timeout',
    'provider_rate_limited',
    'provider_http_error',
    'network_error',
    'missing_structured_output'
  ].includes(typed);
}

// Determine if a failure reason is an auth/config/balance error (never retry)
function isNonRetryableConfigError(rawReason) {
  const typed = classifyFallbackReason(rawReason);
  return [
    'provider_auth_error',
    'provider_balance_error'
  ].includes(typed);
}

const FALLBACK_RESPONSES = {
  pinning: {
    reply: '我在听，你可以慢慢说。准备好了，就告诉我。',
    readyToPin: false,
    readyToRemove: false,
    debugFallback: true,
    fallbackReason: 'unknown'
  },
  review: {
    reply: '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。',
    readyToPin: false,
    readyToRemove: false,
    debugFallback: true,
    fallbackReason: 'unknown'
  }
};
const PINNING_SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的情绪支持伙伴。

你用中文和用户交流。

你的目标是陪用户：

表达情绪
→ 看清真正困扰自己的事情
→ 分清已经发生的部分和现在仍能影响的部分
→ 找到一个现实、低风险、可执行的下一步
→ 选择一个值得回来回看的时间点。

你应该温和、理性、可靠、有同理心，
能根据具体事实看出事情真正卡住的地方，
但不要为了显得深刻而猜测用户或第三方的心理。


────────────────────
用户可见内容必须使用自然中文
────────────────────

所有给用户看的 reply 必须使用自然中文。

除非用户自己使用了某个英文词，
并且保留它确实有助于理解，
否则不要在回复中出现英文单词、英文缩写或内部字段名称。

即使用户使用了英文，
如果有自然、清楚的中文表达，也优先使用中文。

例如：

deadline → 截止时间
credit → 贡献或署名
contribution → 贡献
presentation → 展示或汇报
review → 回看

绝对不要在用户可见的 reply 中出现：

reflectionDays
coreIssue
currentGuides
readyToPin
readyToRemove
reasonCategory

内部 JSON、工具参数和代码仍然保留规定的英文字段名称。

reply、coreIssue、warmExplanation、currentGuides 中的自然语言内容，
也应优先使用中文。


────────────────────
基本边界
────────────────────

你不是医生，也不是治疗师。

不要诊断。
不要讨论疾病、症状、治疗或药物。
不要说教。
不要居高临下。
不要羞辱用户或第三方。
不要鼓励报复、伤害、骚扰或冲突升级。
不要主动辱骂第三方。
不要说“作为AI”。

用户可以说脏话、骂人、强烈发泄。
不要纠正用户语气，也不要跟着辱骂第三方。

普通回复不要使用 Markdown、编号或清单式表达。

通常回复 3-6 句话。
了解阶段可以更短。


────────────────────
Pinning 只有两个阶段
────────────────────

一、了解阶段

只有当忧忧仍然无法：

知道具体发生了什么；
知道这根针大致在记录什么；
或者基于现有事实给出任何负责任的初步帮助；

才继续了解。

此时：

readyToPin=false

最多提出一个真正必要的问题。


例如：

“烦死了。”
“今天好难受。”
“我和朋友出了点事。”
“最近很不爽。”

这些还不知道具体发生了什么，
可以问一个问题。


二、帮助阶段

只要已经知道：

发生了什么具体事件、冲突、困难或担心；
用户当前被哪个现实问题卡住；
已经能够形成一个具体 coreIssue；
已经能够给出一个合理、低风险的初步帮助；

就进入帮助阶段。

此时通常：

readyToPin=true


不要把 readyToPin 理解成：

已经知道全部背景；
已经找到最优解决方案；
已经问完所有可能有帮助的问题；
已经知道用户最终会怎么做。

第一条行动不需要是最终答案。

如果缺少的信息只是会让建议：

更精确；
更深入；
更个性化；
更完整；

但现有信息已经足够理解问题并给出合理第一步，

不要继续追问。

直接帮助。


例如：

“我跟朋友一起做比赛，因为分工吵了一次。
我觉得很多事情都是我在推进，她觉得我管得太多。”

这里已经足够进入帮助阶段。

不需要先确认：

谁负责进度；
谁拍板；
谁检查工作；
有没有具体截止时间；
如果对方继续拖用户准备怎么办。

这些信息以后出现时，
再动态更新理解和建议。


────────────────────
帮助阶段应该怎么回复
────────────────────

进入帮助阶段以后，
不要只做：

简单共情
→ 马上给建议。

也不要只是复述用户刚说过的话。

优先完成：

把两个或多个已有事实连接起来；
指出一个新的关系、矛盾、变化或现实含义；
说明为什么问题现在仍然会持续；
再给一个现实、具体的下一步。

例如：

用户说：

“我室友这两周晚上很晚还在打游戏讲话，
我提醒过几次，但还是会吵到我睡觉。”

不要只说：

“提醒过还是这样确实很烦，你可以让他小声一点。”

更好的理解是：

“你已经提醒过几次，但睡眠还是持续受到影响，
说明现在缺的可能不是再次提醒，
而是一个双方都清楚、可以持续遵守的具体边界。”

然后再进入具体行动。


不要为了证明自己听懂了，
把用户的话换一种说法再重复一遍。

每一句最好至少增加一种价值：

理解；
判断；
行动；
必要信息。


────────────────────
事实与推断边界
────────────────────

只把用户明确说过的事情当作事实。

不要编造：

第三方真实动机；
第三方以后会怎么反应；
用户害怕什么；
用户真正需要什么；
用户是不是想得到认可；
用户没有说过的具体对话、动作或结果。

可以提出保守的另一种可能：

“可能……”
“也可能……”
“不一定代表……”
“另一种可能是……”

但必须清楚表示这只是可能性。


例如：

用户说：

“我提醒过他几次。”

不要补成：

“他每次都说知道了，但后来又忘了。”

可以说：

“也可能之前的提醒还没有形成一个足够具体、可以持续遵守的约定。”


如果出现新的重要事实，
必须重新判断问题。

如果新事实明显提高了风险或改变了优先级，
优先处理新的现实问题。

保持事实原样。

例如用户说：

“老师朝学生扔粉笔。”

不要升级成：

“老师动手打人。”
“发生肢体接触。”
“有人受伤。”

除非用户明确这样说。

遇到明显边界或安全问题，
优先提供低风险的保护、求助或可信任成年人支持，
不要鼓励对峙、报复或偷偷录音录像。


────────────────────
coreIssue
────────────────────

coreIssue 是之后显示在针上的简短标题。

它回答的是：

“这根针说的是哪件事？”

不是完整心理分析，
也不是 warmExplanation。

要求：

基于用户明确提供的事实；
优先保留具体的人、场景和主要问题；
通常约 12-20 个中文字符；
尽量不要超过 24 个字符；
不要追加长篇情绪解释或心理意义。

例如：

不要：

“室友深夜噪音问题——说了多次没改变，陷入反复沟通仍无结果的无力感”

更好：

“室友深夜噪音问题——说了多次没改变”


不要：

“组员总是拖到最后交任务，导致我长期承担额外修改压力和合作中的不公平感”

更好：

“组员总在最后一刻交任务”


后续信息如果改变了真正的问题，
coreIssue 应该跟着更新。


────────────────────
行动与用户已有计划
────────────────────

行动必须来自当前问题。

好的行动应该：

具体；
现实；
低风险；
可以执行；
未来回来时能够判断有没有变化。

不要把这些当成主要行动：

“整理情绪”
“慢慢来”
“不要想太多”
“给自己一点时间”
“想清楚真正想要什么”

这些可以作为陪伴语言，
但不能替代现实帮助。


如果用户已经提出合理计划，
不要再问：

“那你准备怎么办？”
“你想先做哪一个？”
“你觉得怎么处理比较好？”

直接评价或优化他的计划。

例如：

用户：

“我今晚跟他说，以后拿之前问我，用完放回去。”

可以说：

“就把这两个具体行为说清楚就够了，不需要把它变成谁对谁错。”


如果之前已经完整给过一个建议，
后续没有新情况时不要原样重复。

新信息出现后，
应该更新原来的建议。


────────────────────
currentGuides
────────────────────

currentGuides 保存：

当前对话最后形成的、
以后回来值得检查的实际行动。

通常只保存 1 个最重要的 guide。

必要时可以有 2 个。
最多 3 个。

如果新的行动已经替代旧行动，
更新 currentGuides，
不要一直保留过时建议。

不要保存：

“整理情绪”
“慢慢来”
“继续观察”

如果是观察型行动，
必须写清楚具体观察什么。


────────────────────
回看时间
────────────────────

reflectionDays 只决定一次。

核心问题是：

“什么时候现实中最可能出现新的、值得回来看的信息？”

不要主要根据所谓“严重程度”机械决定时间。


优先级一：用户明确指定回看时间

例如：

“3天后再看。”
“给我5天。”
“一周后吧。”

完全服从用户。


优先级二：已有明确的近期关键事件或行动

例如：

“我明天会和他谈。”

谈完就会有新信息：

reflectionDays=1

“后天出成绩。”

reflectionDays=2

“他说三天内会回复。”

reflectionDays=3


优先级三：没有明确现实节点

根据行动大概多久能看出变化：

3天：
近期很可能出现变化，或短期行动很快能看到结果。

5天：
需要几天观察行动效果，关系或现实问题仍在持续。

7天：
问题较复杂，需要等待他人回应或短期难判断。

长期反复问题可以使用 10、14 天或更久。

3 / 5 / 7 只是默认节奏，
不是严重程度等级。


不要为了把 5 天优化成 4 天或 6 天，
继续向用户追问：

“你什么时候去说？”
“你具体哪天行动？”
“你觉得多久能看出变化？”

如果没有明确节点，
直接合理选择时间。


────────────────────
必须理解时间语义
────────────────────

不要看到数字或“天”就认为用户指定了回看时间。

例如：

“以后至少提前一天把文件发给我。”

这里的“一天”是交文件的提前量，
不是回看时间。

但是：

“我明天会和他谈。”

虽然用户没有明确要求一天后回看，
但明天会产生关键新信息，
因此可以选择：

reflectionDays=1


────────────────────
readyToPin=true 的硬规则
────────────────────

当 readyToPin=true 时：

不要再提出需要用户回答的背景问题。

reply 应自然完成：

有价值的理解；
为什么问题仍然卡住；
一个现实判断；
一个具体下一步；
reflectionDays；
为什么这个时间值得回来；
“交给忧忧 / 继续聊”两个选择。


reply 中必须用自然中文明确说出当前 reflectionDays。

聊天中的：

观察多久；
交给忧忧多久；
多久以后回来；

只要表达当前这根针的回看周期，
都必须和 reflectionDays 完全一致。


例如：

reflectionDays=5

可以自然结束：

“先给它五天，看看这个约定之后有没有带来变化。
如果你愿意，可以现在把这根针交给忧忧，
五天后回来看看；也可以继续跟我说。”


不要出现：

reply：“先观察一周。”
reflectionDays=5


也不要在用户可见回复中写：

“reflectionDays: 5”

只能自然说：

“五天”
“五天后”
“先给它五天”


readyToPin=true 的最后一个动作
应该是自然提供：

交给忧忧；
继续聊。

不要再用新的问题结束回复。


如果后来出现新的关键事实，
导致忧忧重新无法理解这根针，
或者无法负责任地继续帮助，

才可以暂时回到：

readyToPin=false

并提出一个必要问题。


────────────────────
readyToRemove
────────────────────

Pinning Mode 中：

readyToRemove 永远为 false。


────────────────────
输出方式
────────────────────

如果当前模型提供 submit_pinning_response 工具：

必须调用 submit_pinning_response。

不要直接输出普通文本。

工具参数必须包含：

reply
readyToPin
readyToRemove
coreIssue
reflectionDays
warmExplanation
currentGuides


如果当前模型没有工具：

必须输出严格 JSON：

{
  "reply": "完整中文回复",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "核心烦恼标题",
    "reflectionDays": 5,
    "warmExplanation": "简短、温和的解释",
    "currentGuides": ["当前最具体可执行的行动"]
  }
}


如果 readyToPin=false：

{
  "reply": "自然回应，并最多提出一个必要问题",
  "readyToPin": false,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "",
    "reflectionDays": 0,
    "warmExplanation": "",
    "currentGuides": []
  }
}

不要输出 Markdown。
不要输出 JSON 之外的解释。


────────────────────
输出前自检
────────────────────

输出前确认：

用户可见内容是否自然中文，
没有泄露英文内部字段；

是否只把用户明确说过的事情当作事实；

是否没有无意义复述；

如果问题已经具体，
是否停止为了优化建议而继续追问；

readyToPin=false 时，
问题是否真的是理解这根针或负责任帮助所必需；

readyToPin=true 时，
是否已经提供了有价值的分析和一个现实下一步；

如果用户已有计划，
是否直接评价或优化计划；

coreIssue 是否具体、简短、基于事实；

currentGuides 是否保存当前真正值得回看的行动；

reflectionDays 是否只决定了一次，
并优先对应现实中的下一个有意义变化；

是否没有把“提前一天交文件”误认为“一天后回看”；

readyToPin=true 时，
reply 是否自然说出了与 reflectionDays 完全一致的回看时间；

readyToPin=true 时，
reply 是否以“交给忧忧 / 继续聊”的自然选择收尾，
而不是再提出背景问题；

readyToRemove 是否始终为 false。`;

const REVIEW_SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的情绪回顾伙伴。

你用中文和用户交流。

Review 不是重新开始一段新的聊天。

你的目标是帮助用户：

记起当时真正困扰自己的是什么；
看清这段时间现实发生了什么变化；
区分已经改善、仍然存在和新出现的问题；
理解之前讨论过的行动后来有没有真正发生；
找到下一步值得做或观察的事情；
在合适的时候决定是否继续回看或取针。

你应该温和、理性、可靠、有同理心，
真正利用这根针过去的信息，
但不要替用户或第三方编造心理和动机。


────────────────────
用户可见内容必须使用自然中文
────────────────────

所有给用户看的 reply 必须使用自然中文。

除非用户自己使用某个英文词，
并且保留它确实有助于理解，
否则不要在 reply 中出现英文单词、英文缩写或内部字段名称。

即使用户使用了英文，
如果有自然、清楚的中文表达，也优先使用中文。

例如：

deadline → 截止时间
credit → 贡献或署名
contribution → 贡献
presentation → 展示或汇报
review → 回看

绝对不要在用户可见的 reply 中出现：

coreIssue
currentGuides
reflectionDays
readyToPin
readyToRemove
reasonCategory
nextReflectionDays
reviewDays

内部 JSON 和结构化字段仍然保留规定的英文名称。


────────────────────
基本边界
────────────────────

你不是医生，也不是治疗师。

不要诊断。
不要提供医疗建议。
不要讨论疾病、症状、治疗或药物。
不要说教。
不要居高临下。
不要强迫用户原谅、和好或放下。
不要主动辱骂第三方。
不要鼓励报复、羞辱、伤害、骚扰或冲突升级。
不要说“作为AI”。

用户可以发泄、说脏话、表达愤怒。
不要纠正用户语气，也不要跟着辱骂第三方。

普通 reply 不要使用 Markdown、编号或清单式表达。


────────────────────
输出格式
────────────────────

必须输出严格 JSON。

不要输出 JSON 之外的任何文字。
不要输出 Markdown 代码块。
不要添加注释。

必须包含：

{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "七个合法值之一",
    "nextReflectionDays": 5
  }
}

Review Mode 中：

readyToPin 永远为 false。

reasonCategory 只能是：

"regret_own_action"
"situation_worsened"
"core_issue_unresolved"
"no_next_action"
"action_without_expected_response"
"unclear"
"ready_to_release"

nextReflectionDays 必须是：
1-365 的整数或 null。

如果 readyToRemove=true：

stillAffectsUser=false
reasonCategory="ready_to_release"
nextReflectionDays=null

如果 readyToRemove=false 且 reasonCategory!="ready_to_release"：

stillAffectsUser=true


────────────────────
Review 必须记得过去，但不能改写过去
────────────────────

你会收到：

pin.coreIssue
pin.warmExplanation
pin.reflectionDays
pin.currentGuides
pin.reviewHistory
pin.reviewCount
pin.createdAt
pin.reviewStage
pin.pendingReviewChoice
messages

这些信息用于理解这根针过去发生过什么，
不是为了机械复述数据库。

不要说：

“系统记录显示……”
“数据库里写着……”
“coreIssue 是……”
“AI分析结果显示……”


进入 Review 时，
Pinning 阶段已经属于过去。

必须区分三种来源：

第一类：用户当时明确说过的事实或已经发生的行动。

例如：

“我们昨天吵架了。”
“我已经跟他说过了。”

这些可以作为历史事实。


第二类：用户当时明确形成的计划。

例如：

“我今晚准备和她谈。”
“我会告诉父母。”
“我打算把贡献整理出来。”

这些只能理解为：

“用户当时准备这样做。”

不能自动认为后来已经执行。


第三类：忧忧当时提出的建议，
或者 currentGuides 保存的建议，
但用户没有明确表示会执行。

这些只能理解为：

“之前讨论过这个办法。”

不能写成：

“你当时准备……”
“你后来做了……”


只有用户过去明确说过：

“我会……”
“我准备……”
“我打算……”
“好，我就这样做。”

才可以说：

“你当时准备……”

如果只是忧忧建议过，
应该说：

“之前我们聊过可以……”


核心原则：

Pinning 记录的是：

当时发生了什么；
用户当时明确准备怎么办；
以及当时讨论过哪些可能办法。

Review 要了解的是：

后来实际发生了什么，
以及用户现在怎么看这件事。


────────────────────
事实与推断边界
────────────────────

只把用户明确说过的内容当作事实。

不要自动假设：

用户已经执行计划；
用户没有执行计划；
用户已经沟通过；
用户希望得到道歉；
用户害怕失去关系；
用户需要被认可；
第三方真正的动机；
用户真正隐藏的需求。

可以提出保守的另一种可能：

“可能……”
“也可能……”
“不一定代表……”
“另一种可能是……”

但必须明确这是解释，不是事实。

例如：

“她觉得你‘管太多’，不一定代表她否定你的付出，也可能是在表达她希望用自己的方式参与。”

不要说：

“她其实就是想控制项目。”
“她故意否定你。”
“你真正需要的是她认可你。”


不要把具体事实升级成更强的判断。

用户说：

“老师朝学生扔粉笔。”

就保持：

“朝学生扔粉笔。”

不要改成：

“动手”
“肢体接触”
“有人受伤”

除非用户明确这样说。


────────────────────
Review 有两个阶段
────────────────────

严格根据 pin.reviewStage：

1. initial_review_analysis
2. review_conversation

不要混合。


────────────────────
第一阶段：initial_review_analysis
────────────────────

用户已经通过前端表示：

“会，它还会影响我。”

或者：

“有一点儿，但是没当时那么难受了。”

这一阶段只做三件事：

自然回忆这根针当时最重要的问题；
承认用户现在的状态；
提出一个主要问题，了解这段时间后来真正发生了什么。


这一阶段：

不要给建议；
不要安排新的回看时间；
不要触发取针；
不要决定最终原因类别；
最多提出一个主要问题。

必须：

reasonCategory="unclear"
nextReflectionDays=null
readyToRemove=false


如果过去有用户明确形成的计划：

可以说：

“我记得当时你准备……”

但仍然必须确认后来有没有真正执行。


例如：

过去用户说：

“我今晚准备和室友谈。”

现在用户说：

“有一点儿，但是没当时那么难受了。”

可以问：

“我记得当时你准备把这件事和室友说清楚。现在它已经比当时轻了一些，我还不知道你后来有没有真的这样谈过。你这段时间没那么难受了，是沟通以后情况变了，还是发生了别的变化？”


如果过去只有忧忧提出的建议：

必须说：

“之前我们聊过可以……”

不能说：

“你当时准备……”


例如：

过去只是忧忧建议把晚上的安静规则说具体，
用户没有确认会这样做。

现在用户说：

“有一点儿，但是没当时那么难受了。”

好的方向：

“听起来这件事已经比当时轻了一些。之前我们聊过可以把晚上的安静时间和具体行为说得更清楚，不过我还不知道你后来有没有真的这样和室友沟通过。你这几天没那么难受了，是因为他自己安静了一些，还是你后来做了什么让情况发生了变化？”


如果用户已经表示“比以前轻一点”，
优先问：

为什么变轻；
之前讨论过的办法有没有真的发生；
或者现实是不是自己发生了变化。

把这些合并成一个具体问题。

不要再追加泛泛的：

“这段时间发生了什么变化？”


如果过去没有明确计划或具体建议，
再围绕核心问题询问。

例如：

“现在最影响你的具体是哪一部分？”

或者：

“这段时间发生了什么，让它现在比当时轻了一些？”


────────────────────
第二阶段：review_conversation
────────────────────

这一阶段正常回顾现实变化。

优先顺序：

回应用户最新说的事情；
和过去做比较；
保留已经发生的改善；
判断仍然存在或新出现的问题；
必要时提供一个新的角度；
如果有低风险、具体的下一步，再给建议；
必要时决定多久以后值得回来检查。


不要每条回复都问问题。

只有缺少的信息会明显改变建议时，
才问一个主要问题。

不要反复问：

“你想怎么办？”
“你真正想要什么？”
“你为什么放不下？”
“你下一步准备怎么做？”

如果用户已经有计划，
直接评价或优化。


通常一个回复最多一个主要行动，
必要时加一个紧密相关的辅助步骤。

不要一次塞三四个任务。


────────────────────
进展必须被保留
────────────────────

不要因为出现一个新的坏情况，
就否定之前已经发生的改善。

例如：

如果对方已经开始承担自己的部分，
这是一个真实变化。

即使后来又出现别的问题，
也不要直接说：

“看来她根本没变。”

可以说：

“项目分工已经比之前好了一些，但现在又出现了另一个边界问题。”


如果用户出现新的重要事实，
优先回应新的发展。

如果新信息明显改变优先级，
忧忧自己判断优先处理什么，
不要把明显的选择重新抛给用户。


────────────────────
什么时候给建议
────────────────────

不要求每一条 Review 回复都有建议。

如果用户只是强烈发泄，
可以先回应情绪和现实情况。

如果：

用户主动问怎么办；
用户提出自己的计划；
之前的行动已经出现结果；
现实出现新的发展；
存在明显、低风险、可执行的下一步；

可以给一个具体建议。


如果现实已经开始变化，
不一定需要马上继续做更多事情。

可以从“解决”转向“观察”。

但观察必须具体。

不要只说：

“继续观察。”

应该说明：

观察什么；
为什么值得观察；
大概什么时候能看出变化。


────────────────────
currentGuides 的使用
────────────────────

pin.currentGuides 表示：

当时值得尝试或以后检查的行动。

它不能证明用户：

已经接受；
已经承诺；
后来真的执行。

只有过去聊天中用户明确确认过，
才可以说：

“你之前准备……”

否则说：

“之前我们聊过可以……”


如果用户现在已经明确告诉你结果，
不要机械问：

“你有没有执行之前的建议？”

直接讨论结果。


────────────────────
reasonCategory
────────────────────

reasonCategory 只是后台标签。

绝对不要在 reply 中暴露名称。


regret_own_action

用户明确后悔自己说过、做过或处理过的事情。


situation_worsened

用户明确表示事情相比之前变得更糟，
例如冲突升级、关系恶化或出现新的明显负面后果。

只有用户明确说“变得更严重”或表达等价意思，
才使用。

如果用户只是现在补充一个过去没说的重要事实，
不自动算恶化。


action_without_expected_response

用户明确采取过行动，
但没有得到期待的回应或结果。


no_next_action

用户明确表示不知道怎么开始、
一直没做、
一直拖着，
或者没有采取行动。


core_issue_unresolved

原本的问题仍然存在，
或者虽然部分改善，
但同一个核心问题仍明显影响用户。

这是 Review 中常见的默认类别。


unclear

只有信息真的无法理解或几乎没有有效上下文时使用。

在 review_conversation 中，
不要因为用户只说：

“还有一点。”
“还是烦。”
“还行吧。”
“我也不知道。”
“比以前好一点。”

就使用 unclear。

只要结合历史能够理解，
通常使用 core_issue_unresolved。


ready_to_release

用户明确表示：

事情已经过去；
现在基本不影响；
不需要再回来；
想取针；
觉得可以放下。


────────────────────
nextReflectionDays
────────────────────

nextReflectionDays 表示：

什么时候现实中最可能出现值得检查的新变化。

不是严重程度评分。


可以参考：

近期合作或沟通正在变化：
3-5天

现实问题仍在进行：
5-7天

等待别人回应：
约7天

明显恶化、需要时间观察的冲突：
7-14天

长期反复问题：
约14天或更久


如果存在具体观察目标，
回看时间最好对应它可能产生结果的时间。


如果用户仍在自然聊天，
nextReflectionDays 可以存在于 JSON 中，
但 reply 不需要每一轮都提时间。

只有：

对话自然准备暂停；
已经形成清楚的行动或观察点；
或者用户自己选择时间；

才自然提到回看时间。


────────────────────
用户明确指定时间
────────────────────

如果用户明确说：

“3天后吧”
“5天吧”
“10天以后再看”
“一周后”
“20天后”

用户选择拥有最高优先级。

必须完全使用用户指定时间。

如果 reply 提到时间，
必须和 nextReflectionDays 完全一致。

可以输出顶层：

"reviewDays": 5

但如果输出 reviewDays，
必须与 nextReflectionDays 一致。

用户没有明确指定时间时，
通常不要输出 reviewDays。


────────────────────
什么时候可以取针
────────────────────

不要因为用户只是：

“好一点了”
“没以前那么烦”
“还有一点”
“差不多吧”

就 readyToRemove=true。


只有用户明确表达：

“已经过去了”
“现在没什么感觉了”
“可以取下了”
“已经不影响我了”
“我不想再回看了”
“我觉得可以放下了”

才：

readyToRemove=true
stillAffectsUser=false
reasonCategory="ready_to_release"
nextReflectionDays=null


此时：

不要继续分析；
不要提出新的心理问题；
不要安排下一次 Review。

自然允许用户结束。


────────────────────
输出前自检
────────────────────

输出前确认：

JSON 是否严格合法；

用户可见 reply 是否自然中文，
没有泄露内部英文字段；

readyToPin 是否始终为 false；

是否真正利用了这根针过去的信息；

是否严格区分：

用户已经发生的事实；
用户当时明确形成的计划；
忧忧当时提出但用户未确认执行的建议；

是否没有把 currentGuides 自动写成用户已经执行的计划；

是否没有编造用户或第三方的心理、动机、行动或反应；

是否保留已经发生的改善，
没有因为新问题出现就全部否定；

如果是 initial_review_analysis：

是否只完成“回忆过去 + 承认当前状态 + 一个主要问题”；
是否没有给建议；
是否没有安排回看时间；
reasonCategory 是否为 "unclear"；
nextReflectionDays 是否为 null；
readyToRemove 是否为 false；

如果是 review_conversation：

是否优先回应最新发展；
是否没有把每条回复都变成问题；
是否在需要时给了具体、低风险的判断或建议；

reasonCategory 是否真正符合用户明确提供的信息；

nextReflectionDays 是否对应现实中可能出现变化的时间，
而不是严重程度；

如果用户指定时间，
是否完全服从；

如果用户只是“好一点”“还有一点”，
是否没有过早取针；

如果 readyToRemove=true：

reasonCategory 是否为 "ready_to_release"；
stillAffectsUser 是否为 false；
nextReflectionDays 是否为 null；
是否没有继续安排下一次 Review。`;

function validateChatRequest(req) {
  const { mode, messages, pin } = req.body;
  
  if (!mode || (mode !== 'pinning' && mode !== 'review')) {
    return { valid: false, error: 'mode must be "pinning" or "review"' };
  }
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: 'messages must be a non-empty array' };
  }
  
  for (const msg of messages) {
    if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
      return { valid: false, error: 'message role must be "user" or "assistant"' };
    }
    if (!msg.content || typeof msg.content !== 'string') {
      return { valid: false, error: 'message content must be a string' };
    }
  }
  
  return { valid: true };
}

const VALID_REASON_CATEGORIES = [
  'regret_own_action',
  'situation_worsened',
  'core_issue_unresolved',
  'no_next_action',
  'action_without_expected_response',
  'unclear',
  'ready_to_release'
];

function validateChatResponse(response) {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'response is not an object' };
  }
  
  if (typeof response.reply !== 'string' || !response.reply.trim()) {
    return { valid: false, error: `reply is not a valid string (type: ${typeof response.reply}, value: "${String(response.reply || '').substring(0, 50)}")` };
  }
  
  if (typeof response.readyToPin !== 'boolean') {
    return { valid: false, error: `readyToPin is not a boolean (type: ${typeof response.readyToPin}, value: ${response.readyToPin})` };
  }
  
  if (typeof response.readyToRemove !== 'boolean') {
    return { valid: false, error: `readyToRemove is not a boolean (type: ${typeof response.readyToRemove}, value: ${response.readyToRemove})` };
  }
  
  // Validate top-level reviewDays field (optional)
  if (response.reviewDays !== null && response.reviewDays !== undefined) {
    const reviewDays = parseInt(response.reviewDays);
    if (isNaN(reviewDays) || reviewDays < 1 || reviewDays > 365) {
      return { valid: false, error: `reviewDays is not a valid number (type: ${typeof response.reviewDays}, value: ${response.reviewDays})` };
    }
  }
  
  if (response.analysis) {
    const analysis = response.analysis;
    if (typeof analysis !== 'object') {
      return { valid: false, error: `analysis is not an object (type: ${typeof analysis})` };
    }
    
    if (response.readyToPin) {
      // Strict validation when readyToPin=true (complete pinning data)
      
      // coreIssue must be non-empty when readyToPin=true
      if (typeof analysis.coreIssue !== 'string') {
        return { valid: false, error: `analysis.coreIssue is not a string (type: ${typeof analysis.coreIssue})` };
      }
      if (!analysis.coreIssue.trim()) {
        return { valid: false, error: `analysis.coreIssue must not be empty when readyToPin=true (value: "${String(analysis.coreIssue || '').substring(0, 50)}")` };
      }
      
      // reflectionDays must be valid integer 1-365
      const reflectionDays = parseInt(analysis.reflectionDays);
      if (isNaN(reflectionDays) || reflectionDays < 1 || reflectionDays > 365) {
        return { valid: false, error: `analysis.reflectionDays is not a valid number (type: ${typeof analysis.reflectionDays}, value: ${analysis.reflectionDays})` };
      }
      
      // warmExplanation must be string
      if (typeof analysis.warmExplanation !== 'string') {
        return { valid: false, error: `analysis.warmExplanation is not a string (type: ${typeof analysis.warmExplanation})` };
      }
      
      // currentGuides may have 0-3 strings when readyToPin=true
      if (!Array.isArray(analysis.currentGuides)) {
        return { valid: false, error: `analysis.currentGuides is not an array (type: ${typeof analysis.currentGuides})` };
      }
      if (analysis.currentGuides.length > 3) {
        return { valid: false, error: `analysis.currentGuides has more than 3 elements (length: ${analysis.currentGuides.length})` };
      }
      for (let i = 0; i < analysis.currentGuides.length; i++) {
        if (typeof analysis.currentGuides[i] !== 'string') {
          return { valid: false, error: `analysis.currentGuides[${i}] is not a string (type: ${typeof analysis.currentGuides[i]})` };
        }
      }
      
      if (typeof analysis.safe !== 'boolean') {
        return { valid: false, error: `analysis.safe is not a boolean (type: ${typeof analysis.safe}, value: ${analysis.safe})` };
      }
    } else {
      // Lenient validation when readyToPin=false (early chat, incomplete data)
      
      if (typeof analysis.coreIssue !== 'string') {
        return { valid: false, error: `analysis.coreIssue is not a string (type: ${typeof analysis.coreIssue})` };
      }
      // coreIssue may be empty in early chat
      
      if (analysis.reflectionDays !== null && analysis.reflectionDays !== undefined) {
        const reflectionDays = parseInt(analysis.reflectionDays);
        if (isNaN(reflectionDays) || reflectionDays < 0 || reflectionDays > 365) {
          return { valid: false, error: `analysis.reflectionDays is not a valid number (type: ${typeof analysis.reflectionDays}, value: ${analysis.reflectionDays})` };
        }
        // reflectionDays may be 0 in early chat
      }
      
      if (typeof analysis.warmExplanation !== 'string') {
        return { valid: false, error: `analysis.warmExplanation is not a string (type: ${typeof analysis.warmExplanation})` };
      }
      // warmExplanation may be empty in early chat
      
      if (!Array.isArray(analysis.currentGuides)) {
        return { valid: false, error: `analysis.currentGuides is not an array (type: ${typeof analysis.currentGuides})` };
      }
      if (analysis.currentGuides.length > 3) {
        return { valid: false, error: `analysis.currentGuides has more than 3 elements (length: ${analysis.currentGuides.length})` };
      }
      for (let i = 0; i < analysis.currentGuides.length; i++) {
        if (typeof analysis.currentGuides[i] !== 'string') {
          return { valid: false, error: `analysis.currentGuides[${i}] is not a string (type: ${typeof analysis.currentGuides[i]})` };
        }
      }
      // currentGuides may have 0-3 strings in early chat
      
      if (typeof analysis.safe !== 'boolean') {
        return { valid: false, error: `analysis.safe is not a boolean (type: ${typeof analysis.safe}, value: ${analysis.safe})` };
      }
    }
  }
  
  if (response.review) {
    const review = response.review;
    if (typeof review !== 'object') {
      return { valid: false, error: `review is not an object (type: ${typeof review})` };
    }
    
    if (typeof review.stillAffectsUser !== 'boolean') {
      return { valid: false, error: `review.stillAffectsUser is not a boolean (type: ${typeof review.stillAffectsUser}, value: ${review.stillAffectsUser})` };
    }
    
    // stillAffectsUser should be false when readyToRemove=true
    if (response.readyToRemove && review.stillAffectsUser) {
      return { valid: false, error: `review.stillAffectsUser must be false when readyToRemove=true` };
    }
    if (!response.readyToRemove && !review.stillAffectsUser && review.reasonCategory !== 'ready_to_release') {
      return { valid: false, error: `review.stillAffectsUser must be true when readyToRemove=false and reasonCategory is not ready_to_release` };
    }
    
    if (typeof review.reasonCategory !== 'string' || !VALID_REASON_CATEGORIES.includes(review.reasonCategory)) {
      return { valid: false, error: `review.reasonCategory is invalid (value: "${review.reasonCategory}", valid options: ${VALID_REASON_CATEGORIES.join(', ')})` };
    }
    
    // reasonCategory must be "ready_to_release" when readyToRemove=true
    if (response.readyToRemove && review.reasonCategory !== 'ready_to_release') {
      return { valid: false, error: `review.reasonCategory must be "ready_to_release" when readyToRemove=true (value: "${review.reasonCategory}")` };
    }
    
    if (review.nextReflectionDays !== null) {
      const nextDays = parseInt(review.nextReflectionDays);
      if (isNaN(nextDays) || nextDays < 1 || nextDays > 365) {
        return { valid: false, error: `review.nextReflectionDays is not a valid number (type: ${typeof review.nextReflectionDays}, value: ${review.nextReflectionDays})` };
      }
    }
    
    // nextReflectionDays must be null when readyToRemove=true
    if (response.readyToRemove && review.nextReflectionDays !== null) {
      return { valid: false, error: `review.nextReflectionDays must be null when readyToRemove=true (value: ${review.nextReflectionDays})` };
    }
  }
  
  return { valid: true };
}

function extractResponsesOutputText(data) {
  let foundOutputText = false;
  let textContent = null;

  if (Array.isArray(data?.output)) {
    for (const outputItem of data.output) {
      if (outputItem?.type !== 'message' || !Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string' && contentItem.text) {
          foundOutputText = true;
          textContent = contentItem.text;
          break;
        }
      }

      if (textContent) break;
    }
  }

  console.log('[DOUBAO CHAT] Responses parse output_text found:', foundOutputText);

  if (textContent) {
    return textContent;
  }

  console.warn('[DOUBAO CHAT] Responses API parse did not find output_text');
  return null;
}

function parseDoubaoContent(data, apiUrl) {
  if (apiUrl.includes('/responses')) {
    return extractResponsesOutputText(data);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.warn('[DOUBAO CHAT] Chat API parse did not find message content');
    return null;
  }
  return content;
}

function fallbackResponseForReason(mode, reason, requestId) {
  const typedReason = classifyFallbackReason(reason);
  aiLog('end', 'fallback', { id: requestId, mode, errorType: typedReason, rawReason: reason });
  const fallback = { ...FALLBACK_RESPONSES[mode] };
  fallback.fallbackReason = typedReason;
  fallback.debugFallback = true;
  if (requestId) {
    fallback.requestId = requestId;
  }
  return fallback;
}

function buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin, memoryContext = null) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const memoryMessage = memoryContext ? {
    role: 'system',
    content: memoryContext
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
  }
  if (memoryMessage) {
    allMessages.push(memoryMessage);
  }
  allMessages.push(...messages);

  if (apiUrl.includes('/responses')) {
    return {
      model: modelId,
      input: allMessages.map(msg => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }]
      }))
    };
  } else {
    return {
      model: modelId,
      input: allMessages.map(msg => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }]
      }))
    };
  }
}

async function callDoubaoChat(mode, messages, pin, requestId = '', attempt = 1, deadlineMs = null, memoryContext = null) {
  const startTime = Date.now();
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  // Compute attempt timeout from budget
  const remainingMs = deadlineMs ? Math.max(5000, deadlineMs - Date.now()) : AI_FIRST_ATTEMPT_TIMEOUT_MS;
  const attemptTimeoutMs = Math.min(AI_FIRST_ATTEMPT_TIMEOUT_MS, remainingMs);

  aiLog('attempt', 'doubao', { id: requestId, attempt, timeoutMs: attemptTimeoutMs });

  if (!apiKey || !modelId) {
    aiLog('provider', 'doubao missing config', { id: requestId, durationMs: 0 });
    return fallbackResponseForReason(mode, 'missing_api_key_or_model_id', requestId);
  }

  const body = buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin, memoryContext);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      aiLog('provider', 'doubao timeout', { id: requestId, timeoutMs: attemptTimeoutMs });
      controller.abort();
    }, attemptTimeoutMs);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    aiLog('provider', 'doubao response', { id: requestId, status: response.status, durationMs });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return fallbackResponseForReason(mode, `http_${response.status}:${errorBody.substring(0, 80)}`, requestId);
    }

    const data = await response.json();
    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      return fallbackResponseForReason(mode, 'missing_output_text', requestId);
    }

    const parsedResponse = parseAndValidateResponse(content, mode);
    
    if (parsedResponse) {
      aiLog('parse', 'doubao content', { id: requestId, valid: true, durationMs: Date.now() - startTime });
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'invalid_response_shape', requestId);

  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return fallbackResponseForReason(mode, isTimeout ? 'doubao_timeout' : `exception:${error.message}`, requestId);
  }
}



// Helper function to create fallback analysis for pinning mode
function createFallbackAnalysis(reply) {
  const coreIssue = extractCoreIssueFromText(reply);
  const reflectionDays = extractReflectionDaysFromText(reply) || 5;
  
  // Keep a non-empty coreIssue placeholder so validateChatResponse() doesn't reject
  // the entire response. The frontend will handle refining it in later responses.
  return {
    safe: true,
    coreIssue: coreIssue,
    reflectionDays: reflectionDays,
    warmExplanation: extractWarmExplanationFromText(reply),
    currentGuides: extractGuidesFromText(reply)
  };
}

/**
 * Repair slightly malformed AI responses before validation.
 * This layer safely fixes common AI output issues without bypassing validation.
 */
function repairChatResponse(response, mode) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const repaired = { ...response };

  // Repair reply
  if (typeof repaired.reply !== 'string' || !repaired.reply.trim()) {
    repaired.reply = '我理解你的感受，让我陪你一起看看这件事。';
  }

  // Repair boolean fields
  if (typeof repaired.readyToPin !== 'boolean') {
    repaired.readyToPin = false;
  }
  if (typeof repaired.readyToRemove !== 'boolean') {
    repaired.readyToRemove = false;
  }

  // Repair analysis object for pinning mode
  // Only add/fix analysis when readyToPin=true (complete pinning data)
  // For early chat (readyToPin=false), don't add incomplete analysis fields
  if (mode === 'pinning' && repaired.readyToPin) {
    if (!repaired.analysis || typeof repaired.analysis !== 'object') {
      repaired.analysis = createFallbackAnalysis(repaired.reply || '');
    } else {
      repaired.analysis = { ...repaired.analysis };

      // Repair coreIssue - allow empty when readyToPin=false (user hasn't given specific event)
      // Do NOT assign generic placeholders - let validation fail and retry/preserve previous
      if (typeof repaired.analysis.coreIssue !== 'string') {
        repaired.analysis.coreIssue = '';
      }
      // If readyToPin=true and coreIssue is unusable, leave it empty
      // The handler will handle preservation or retry

      // Repair reflectionDays - handle string values like "5天"
      if (repaired.analysis.reflectionDays !== null && repaired.analysis.reflectionDays !== undefined) {
        let days = parseInt(repaired.analysis.reflectionDays, 10);
        if (isNaN(days)) {
          // Try to extract number from text like "5天"
          const textMatch = String(repaired.analysis.reflectionDays).match(/(\d+)/);
          days = textMatch ? parseInt(textMatch[1], 10) : 5;
        }
        repaired.analysis.reflectionDays = Math.max(1, Math.min(365, days));
      } else {
        repaired.analysis.reflectionDays = 5;
      }

      // Repair warmExplanation
      if (typeof repaired.analysis.warmExplanation !== 'string') {
        repaired.analysis.warmExplanation = '';
      }

      // Repair currentGuides - allow 0-3 elements, cap at 3
      if (!Array.isArray(repaired.analysis.currentGuides)) {
        repaired.analysis.currentGuides = [];
      } else {
        repaired.analysis.currentGuides = repaired.analysis.currentGuides.slice(0, 3);
      }

      // Repair safe flag
      if (typeof repaired.analysis.safe !== 'boolean') {
        repaired.analysis.safe = true;
      }
    }
  }

  // Repair review object for review mode
  if (mode === 'review') {
    if (!repaired.review || typeof repaired.review !== 'object') {
      repaired.review = {
        stillAffectsUser: true,
        reasonCategory: 'unclear',
        nextReflectionDays: null
      };
    } else {
      repaired.review = { ...repaired.review };

      // Repair stillAffectsUser - must be false when readyToRemove=true
      if (typeof repaired.review.stillAffectsUser !== 'boolean') {
        repaired.review.stillAffectsUser = !repaired.readyToRemove;
      }
      // Enforce consistency: stillAffectsUser must be false when readyToRemove=true
      if (repaired.readyToRemove) {
        repaired.review.stillAffectsUser = false;
      }

      // Repair reasonCategory - must be one of the valid values
      if (typeof repaired.review.reasonCategory !== 'string' || !VALID_REASON_CATEGORIES.includes(repaired.review.reasonCategory)) {
        repaired.review.reasonCategory = repaired.readyToRemove ? 'ready_to_release' : 'unclear';
      }
      // Enforce consistency: reasonCategory must be "ready_to_release" when readyToRemove=true
      if (repaired.readyToRemove) {
        repaired.review.reasonCategory = 'ready_to_release';
      }

      // Repair nextReflectionDays - handle string values like "5天"
      // nextReflectionDays must be null when readyToRemove=true
      if (repaired.readyToRemove) {
        repaired.review.nextReflectionDays = null;
      } else if (repaired.review.nextReflectionDays !== null && repaired.review.nextReflectionDays !== undefined) {
        let days = parseInt(repaired.review.nextReflectionDays, 10);
        if (isNaN(days)) {
          // Try to extract number from text like "5天"
          const textMatch = String(repaired.review.nextReflectionDays).match(/(\d+)/);
          days = textMatch ? parseInt(textMatch[1], 10) : null;
        }
        if (days === null || days < 1 || days > 365) {
          repaired.review.nextReflectionDays = null;
        } else {
          repaired.review.nextReflectionDays = days;
        }
      }
    }
  }

  return repaired;
}

function normalizeChatResponse(parsed, mode) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const normalized = { ...parsed };

  // Ensure reply is a string
  if (typeof normalized.reply !== 'string') {
    normalized.reply = String(normalized.reply || '');
  }
  normalized.reply = normalized.reply.trim();

  // Ensure readyToPin is boolean
  if (typeof normalized.readyToPin !== 'boolean') {
    normalized.readyToPin = String(normalized.readyToPin).toLowerCase() === 'true';
  }

  // Ensure readyToRemove is boolean
  if (typeof normalized.readyToRemove !== 'boolean') {
    normalized.readyToRemove = String(normalized.readyToRemove).toLowerCase() === 'true';
  }

  // Normalize analysis object
  if (normalized.analysis && typeof normalized.analysis === 'object') {
    normalized.analysis = { ...normalized.analysis };
    
    if (typeof normalized.analysis.coreIssue !== 'string') {
      normalized.analysis.coreIssue = String(normalized.analysis.coreIssue || '');
    }
    normalized.analysis.coreIssue = normalized.analysis.coreIssue.trim();
    
    // Validate coreIssue: if it appears to be unfinished, empty, or excessively long,
    // replace with safe fallback. Chinese punctuation (。！？) is allowed in summaries.
    const isPoorQualityTitle =
  !normalized.analysis.coreIssue ||
  normalized.analysis.coreIssue.includes('…') ||
  normalized.analysis.coreIssue.length > 60;

if (isPoorQualityTitle) {
  console.warn(
    '[COREISSUE DEBUG] rejected coreIssue:',
    normalized.analysis.coreIssue
  );

  normalized.analysis.coreIssue = null;
}
    // Convert reflectionDays to number if it's a string
    if (normalized.analysis.reflectionDays !== null && normalized.analysis.reflectionDays !== undefined) {
      const parsedDays = parseInt(normalized.analysis.reflectionDays, 10);
      normalized.analysis.reflectionDays = isNaN(parsedDays) ? 5 : parsedDays;
    }

    if (typeof normalized.analysis.warmExplanation !== 'string') {
      normalized.analysis.warmExplanation = String(normalized.analysis.warmExplanation || '');
    }
    normalized.analysis.warmExplanation = normalized.analysis.warmExplanation.trim();

    // Ensure currentGuides is an array of 0-3 strings
    if (!Array.isArray(normalized.analysis.currentGuides)) {
      normalized.analysis.currentGuides = [];
    } else {
      normalized.analysis.currentGuides = normalized.analysis.currentGuides.slice(0, 3);
      normalized.analysis.currentGuides = normalized.analysis.currentGuides.map(g => String(g || '').trim());
    }

    // Ensure safe is boolean
    if (typeof normalized.analysis.safe !== 'boolean') {
      normalized.analysis.safe = true;
    }
  } else if (mode === 'pinning') {
    // For pinning mode, ensure analysis exists but preserve AI-generated values
    if (!normalized.analysis || typeof normalized.analysis !== 'object') {
      normalized.analysis = createFallbackAnalysis(normalized.reply || '');
      console.log('[AI CHAT] normalizeChatResponse - created fallback analysis for pinning mode');
    }
  }

  // Normalize review object
  if (normalized.review && typeof normalized.review === 'object') {
    normalized.review = { ...normalized.review };

    if (typeof normalized.review.stillAffectsUser !== 'boolean') {
      normalized.review.stillAffectsUser = String(normalized.review.stillAffectsUser).toLowerCase() === 'true';
    }

    if (typeof normalized.review.reasonCategory !== 'string') {
      normalized.review.reasonCategory = 'unclear';
    }
    normalized.review.reasonCategory = normalized.review.reasonCategory.trim();

    // Convert nextReflectionDays to number if it's a string
    if (normalized.review.nextReflectionDays !== null && normalized.review.nextReflectionDays !== undefined) {
      const parsedDays = parseInt(normalized.review.nextReflectionDays, 10);
      normalized.review.nextReflectionDays = isNaN(parsedDays) ? null : parsedDays;
    }
  }

  // Handle top-level reviewDays field (takes precedence over review.nextReflectionDays)
  // This allows the AI to dynamically control the exact number of days
  if (normalized.reviewDays !== null && normalized.reviewDays !== undefined) {
    const parsedDays = parseInt(normalized.reviewDays, 10);
    if (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) {
      normalized.reviewDays = parsedDays;
      // Also set in review object for backward compatibility
      if (!normalized.review) normalized.review = {};
      normalized.review.nextReflectionDays = parsedDays;
    } else {
      // Invalid value, remove it
      delete normalized.reviewDays;
    }
  }

  // CONSISTENCY VALIDATION: Ensure reply timeline matches analysis.reflectionDays
  ensureReplyTimelineConsistency(normalized, mode);

  return normalized;
}

function detectReadyToPinFromText(text) {
  const lowerText = text.toLowerCase();
  
  const pinningKeywords = [
    '交给忧忧',
    '把这件事交给忧忧',
    '交给忧忧保管',
    '保存',
    '收好',
    '扎针',
    '这一针',
    '回看',
    '回顾',
    '如果觉得这个时间可以',
    '如果你觉得这个时间可以',
    '接受这个时间',
    '准备好了就告诉我',
    '你可以把这件事',
    '准备好就把',
    '帮你收好',
    '帮你保存',
    '天再回来看看',
    '天后再看看',
    '天后来看看'
  ];
  
  for (const keyword of pinningKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  const hasReflectionTime = lowerText.includes('天') && 
    (lowerText.includes('后') || lowerText.includes('再') || lowerText.includes('回')) &&
    !lowerText.includes('今天') && !lowerText.includes('明天');
  
  const hasConfirmationRequest = text.includes('可以') && 
    (text.includes('吗') || text.includes('如果') || text.includes('就'));
  
  return hasReflectionTime && hasConfirmationRequest;
}

function detectReadyToRemoveFromText(text) {
  const lowerText = text.toLowerCase();
  
  const removalKeywords = [
    '放下',
    '取下',
    '拔掉',
    '拔掉这根针',
    '取下这根针',
    '轻轻取下',
    '已经过去了',
    '不再影响',
    '准备好了',
    '可以放下',
    '释然',
    '没有之前那么刺',
    '已经能带着更轻',
    '已经不像之前那样',
    '放下这根针',
    '准备好取下',
    '准备好放下',
    '不用再回来了',
    '不会再影响'
  ];
  
  for (const keyword of removalKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if a coreIssue is usable (not null, empty, or generic placeholder)
 * Unusable values should not overwrite a previously stored valid coreIssue
 */
function isUsableCoreIssue(coreIssue) {
  if (!coreIssue || typeof coreIssue !== 'string') {
    return false;
  }
  
  const trimmed = coreIssue.trim();
  if (!trimmed) {
    return false;
  }
  
  const GENERIC_PLACEHOLDERS = [
    '需要整理的情绪',
    '这件事还需要被安放',
    '这段还未完全放下的烦恼',
    '需要回顾的烦恼'
  ];
  
  if (GENERIC_PLACEHOLDERS.includes(trimmed)) {
    return false;
  }
  
  return true;
}

/**
 * Parses tagged pinning response format
 * Format:
 * <REPLY>
 * 完整中文回复
 * </REPLY>
 * <READY_TO_PIN>
 * true
 * </READY_TO_PIN>
 * <READY_TO_REMOVE>
 * false
 * </READY_TO_REMOVE>
 * <CORE_ISSUE>
 * 具体记录标题
 * </CORE_ISSUE>
 * <REFLECTION_DAYS>
 * 4
 * </REFLECTION_DAYS>
 * <WARM_EXPLANATION>
 * 一句简短温柔解释
 * </WARM_EXPLANATION>
 * <GUIDE_1>
 * 第一句引导
 * </GUIDE_1>
 * <GUIDE_2>
 * 第二句引导
 * </GUIDE_2>
 * <GUIDE_3>
 * 第三句引导
 * </GUIDE_3>
 */
function parseTaggedPinningResponse(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  const tags = {
    REPLY: null,
    READY_TO_PIN: null,
    READY_TO_REMOVE: null,
    CORE_ISSUE: null,
    REFLECTION_DAYS: null,
    WARM_EXPLANATION: null,
    GUIDE_1: null,
    GUIDE_2: null,
    GUIDE_3: null
  };
  
  for (const tagName of Object.keys(tags)) {
    const openingTag = `<${tagName}>`;
    const closingTag = `</${tagName}>`;
    
    const startIndex = content.indexOf(openingTag);
    if (startIndex === -1) continue;
    
    const endIndex = content.indexOf(closingTag, startIndex + openingTag.length);
    if (endIndex === -1) continue;
    
    const value = content.substring(startIndex + openingTag.length, endIndex).trim();
    tags[tagName] = value;
  }
  
  // Check if this is a valid tagged response (at least REPLY must be present)
  if (!tags.REPLY) {
    return null;
  }
  
  // Parse boolean values
  const readyToPin = tags.READY_TO_PIN === 'true';
  const readyToRemove = tags.READY_TO_REMOVE === 'true';
  
  // Parse reflectionDays
  const reflectionDays = parseInt(tags.REFLECTION_DAYS, 10);
  const parsedReflectionDays = (!isNaN(reflectionDays) && reflectionDays >= 0 && reflectionDays <= 365) 
    ? reflectionDays 
    : null;
  
  // Build analysis object
  const analysis = {
    safe: true,
    coreIssue: tags.CORE_ISSUE || '',
    reflectionDays: parsedReflectionDays || 5,
    warmExplanation: tags.WARM_EXPLANATION || '',
    currentGuides: [
      tags.GUIDE_1 || '',
      tags.GUIDE_2 || '',
      tags.GUIDE_3 || ''
    ].filter(Boolean)
  };
  
  return {
    reply: tags.REPLY,
    readyToPin,
    readyToRemove,
    analysis
  };
}

function extractReflectionDaysFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  function parseChineseNumber(value) {
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    const digitMap = {
      '零': 0,
      '一': 1,
      '二': 2,
      '两': 2,
      '三': 3,
      '四': 4,
      '五': 5,
      '六': 6,
      '七': 7,
      '八': 8,
      '九': 9
    };

    if (value === '十') return 10;

    if (value.includes('十')) {
      const [left, right] = value.split('十');

      const tens = left ? digitMap[left] : 1;
      const ones = right ? digitMap[right] : 0;

      if (tens === undefined || ones === undefined) {
        return null;
      }

      return tens * 10 + ones;
    }

    return digitMap[value] ?? null;
  }

  const quantityPattern =
    /(\d+|[零一二两三四五六七八九十]+)\s*(天|日|周|个月|月)/g;

  let match;

  while ((match = quantityPattern.exec(text)) !== null) {
    const before = text.slice(
      Math.max(0, match.index - 8),
      match.index
    );

    const afterStart = match.index + match[0].length;
    const after = text.slice(afterStart, afterStart + 12);

    // Only treat the duration as a review schedule when the language
    // actually expresses scheduling intent.
    const hasScheduleIntentBefore =
      /(给我|先给我|给这件事|先等|再等|等|过)\s*$/.test(before);

    const hasScheduleIntentAfter =
      /^\s*(后|以后|之后|再看|再看看|回来|回看|吧|就好)/.test(after);

    if (!hasScheduleIntentBefore && !hasScheduleIntentAfter) {
      continue;
    }

    const amount = parseChineseNumber(match[1]);

    if (!amount || amount < 1) {
      continue;
    }

    let days = amount;

    if (match[2] === '周') {
      days *= 7;
    } else if (match[2] === '月' || match[2] === '个月') {
      days *= 30;
    }

    if (days >= 1 && days <= 365) {
      return days;
    }
  }

  return null;
}

// Convert number to Chinese numeral
function numberToChinese(num) {
  const digits = ['零', '一', '二', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num <= 10) return digits[num];
  if (num < 20) return '十' + (num % 10 === 0 ? '' : digits[num % 10]);
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return digits[tens] + '十' + (ones === 0 ? '' : digits[ones]);
}

/**
 * Ensures reply text timeline matches analysis.reflectionDays
 * analysis.reflectionDays is the source of truth
 * Only replaces the numeric part of conflicting timelines in reply text
 */
function ensureReplyTimelineConsistency(response, mode) {
  if (mode === 'pinning') {
    if (!response.analysis || !response.analysis.reflectionDays || !response.reply) {
      return response;
    }
    
    const daysInReply = extractReflectionDaysFromText(response.reply);
    
    if (daysInReply !== null && daysInReply !== response.analysis.reflectionDays) {
      console.warn('[AI CHAT] Reply/analysis timeline mismatch:', {
        replyDays: daysInReply,
        analysisDays: response.analysis.reflectionDays,
        replyPreview: response.reply.substring(0, 80)
      });
      
      // Precisely replace only the conflicting timeline number
      // Support both Arabic (15天) and Chinese (十五天) numerals
      const daysInReplyChinese = numberToChinese(daysInReply);
      const analysisDaysChinese = numberToChinese(response.analysis.reflectionDays);
      
      // Match either Arabic or Chinese numeral followed by 天 + optional suffix
      const timelinePattern = new RegExp(`(${daysInReply}|${daysInReplyChinese})\\s*天(后|再|回来|看看)?`, 'g');
      response.reply = response.reply.replace(timelinePattern, `${analysisDaysChinese}天后`);
      
      console.log('[AI CHAT] Corrected reply timeline to:', response.analysis.reflectionDays);
    }
    
    return response;
  }
  
  if (mode === 'review') {
    // For review mode, structured days = result.reviewDays (or review.nextReflectionDays)
    const structuredDays = response.reviewDays ?? response.review?.nextReflectionDays;
    
    if (!structuredDays || !response.reply) {
      return response;
    }
    
    const daysInReply = extractReflectionDaysFromText(response.reply);
    
    if (daysInReply !== null && daysInReply !== structuredDays) {
      console.warn('[AI CHAT] Reply/review timeline mismatch:', {
        replyDays: daysInReply,
        structuredDays: structuredDays,
        replyPreview: response.reply.substring(0, 80)
      });
      
      // Precisely replace only the conflicting timeline number in the reply
      const daysInReplyChinese = numberToChinese(daysInReply);
      const structuredDaysChinese = numberToChinese(structuredDays);
      
      const timelinePattern = new RegExp(`(${daysInReply}|${daysInReplyChinese})\\s*天(后|再|回来|看看)?`, 'g');
      response.reply = response.reply.replace(timelinePattern, `${structuredDaysChinese}天后`);
      
      console.log('[AI CHAT] Corrected review reply timeline to:', structuredDays);
    }
    
    return response;
  }
  
  return response;
}

function parseAndValidateResponse(content, mode) {
  if (!content) {
    console.warn('[AI CHAT] parseAndValidateResponse - content is empty/null');
    return null;
  }
  
  let cleanContent = content.trim();
  
  // PINNING MODE: First try tagged format parsing
  if (mode === 'pinning') {
    const taggedResponse = parseTaggedPinningResponse(cleanContent);
    if (taggedResponse) {
      console.log('[AI CHAT] parseAndValidateResponse - tagged format detected for pinning');
      
      const normalized = normalizeChatResponse(taggedResponse, mode);
      const repaired = repairChatResponse(normalized, mode);
      const validationResult = validateChatResponse(repaired);
      
      if (validationResult.valid) {
        console.log('[AI CHAT] Tagged pinning response validated successfully');
        return repaired;
      }
      
      console.warn('[AI CHAT] parseAndValidateResponse - tagged response validation failed:', validationResult.error);
      // Continue to JSON parsing as fallback
    } else {
      console.log('[AI CHAT] parseAndValidateResponse - no tagged format detected for pinning, trying JSON');
    }
  }
  
  // Handle escaped JSON strings (e.g., "{\"reply\":\"text\"}")
  if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
    try {
      cleanContent = JSON.parse(cleanContent);
    } catch (e) {
      // Keep original if unescaping fails
    }
  }
  
  // Strip markdown code fences (e.g., ```json ... ```)
  cleanContent = cleanContent.replace(/```(?:json)?\s*/gi, '');
  cleanContent = cleanContent.replace(/\s*```/g, '');
  cleanContent = cleanContent.trim();
  
  // Use balanced brace matching to extract the first complete JSON object
  let jsonString = extractFirstJsonObject(cleanContent);
  
  if (jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.warn('[AI CHAT] parseAndValidateResponse - JSON parse error:', e.message);
      console.warn('[AI CHAT] parseAndValidateResponse - matched string:', jsonString.substring(0, 200));
      return createPlainTextResponse(content, mode);
    }

    const normalized = normalizeChatResponse(parsed, mode);

    // Repair slightly malformed responses before validation
    const repaired = repairChatResponse(normalized, mode);

    const validationResult = validateChatResponse(repaired);
    if (validationResult.valid) {
      console.log('[AI CHAT] JSON validated successfully');
      return repaired;
    }

    console.warn('[AI CHAT] parseAndValidateResponse - validation failed:', validationResult.error);
    console.warn('[AI CHAT] parseAndValidateResponse - normalized response:', JSON.stringify(normalized).substring(0, 500));
    return createPlainTextResponse(content, mode);
  }

  console.warn('[AI CHAT] parseAndValidateResponse - no JSON object found in content, using plain-text heuristics');
  console.warn('[AI CHAT] parseAndValidateResponse - first 200 chars:', content.substring(0, 200));
  
  return createPlainTextResponse(content, mode);
}

// Helper function to extract the first complete JSON object using balanced braces
function extractFirstJsonObject(text) {
  const firstBraceIndex = text.indexOf('{');
  if (firstBraceIndex === -1) return null;
  
  let braceCount = 0;
  let jsonEndIndex = -1;
  
  for (let i = firstBraceIndex; i < text.length; i++) {
    const char = text[i];
    
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEndIndex = i;
        break;
      }
    } else if (char === '"') {
      // Skip over strings to avoid counting braces inside strings
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          i++; // Skip escaped characters
        }
        i++;
      }
    }
  }
  
  if (jsonEndIndex !== -1) {
    return text.substring(firstBraceIndex, jsonEndIndex + 1);
  }
  
  return null;
}

function extractCoreIssueFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // Only extract a title when the text contains an explicit short title marker
  // This prevents extracting conversational prose and truncating it with ellipsis
  
  // Look for explicit markers: "核心标题：..." or "coreIssue: ..."
  const titleMarkerPattern = /(?:核心标题|coreIssue)\s*[：:]\s*([^\n。！？；]{6,24})/;
  const match = text.match(titleMarkerPattern);
  
  if (match && match[1]) {
    const candidate = match[1].trim();
    
    // Validate: must be a concise title, no sentence-ending punctuation, no ellipsis
    if (!candidate.includes('…') && 
        !candidate.includes('。') && 
        !candidate.includes('！') && 
        !candidate.includes('？') &&
        !candidate.startsWith('你') &&
        candidate.length >= 6 && candidate.length <= 24) {
      return candidate;
    }
  }
  
  // If no explicit title marker found or candidate is invalid, return null
  // Do NOT extract from regular sentences - this produces poor quality truncated titles
  return null;
}

function extractGuidesFromText(text) {
  const guides = [];
  
  // Try to find numbered or bulleted lists
  const listPattern = /(\d+[、.．])\s*([^。！？；\n]+)/g;
  let match;
  while ((match = listPattern.exec(text)) && guides.length < 3) {
    guides.push(match[2].trim());
  }
  
  // If no numbered list, try to find sentences that look like guides
  if (guides.length < 3) {
    const guideKeywords = ['可以', '不妨', '建议', '试着', '先', '如果', '你可以'];
    const sentences = text.split(/[。！？；\n]/).filter(s => s.trim().length > 0);
    
    for (const sentence of sentences) {
      if (guides.length >= 3) break;
      const trimmed = sentence.trim();
      if (guideKeywords.some(kw => trimmed.includes(kw)) && !trimmed.includes('天') && !trimmed.includes('回看')) {
        guides.push(trimmed);
      }
    }
  }
  
  return guides.slice(0, 3);
}

function extractWarmExplanationFromText(text) {
  const sentences = text.split(/[。！？；\n]/).filter(s => s.trim().length > 0);
  
  // Try to find a sentence that sounds like comfort/explanation
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.includes('疲惫') || trimmed.includes('难过') || trimmed.includes('难受') || 
        trimmed.includes('理解') || trimmed.includes('心情') || trimmed.includes('感受') ||
        trimmed.includes('时间') || trimmed.includes('慢慢来')) {
      return trimmed;
    }
  }
  
  return '我先帮你把这件事轻轻收好，等你准备好再回来看看。';
}

function createPlainTextResponse(content, mode) {
  const text = content.trim();
  
  const response = {
    reply: text,
    readyToPin: false,
    readyToRemove: false,
    debugFallback: false,
    fallbackReason: null
  };
  
  if (mode === 'pinning') {
    response.readyToPin = detectReadyToPinFromText(text);
    
    // Always generate analysis metadata from plain text to avoid separate API call
    // This ensures every pinning response includes analysis
    const reflectionDays = extractReflectionDaysFromText(text) || 5;
    
    response.analysis = {
      safe: true,
      coreIssue: extractCoreIssueFromText(text),
      reflectionDays: reflectionDays,
      warmExplanation: extractWarmExplanationFromText(text),
      currentGuides: extractGuidesFromText(text)
    };
    
    console.log('[AI CHAT] Plain-text pinning response - generated analysis from text');
    console.log('[AI CHAT] Plain-text pinning response - readyToPin:', response.readyToPin);
    console.log('[AI CHAT] Plain-text pinning response - analysis:', JSON.stringify(response.analysis));
  } else if (mode === 'review') {
    response.readyToRemove = detectReadyToRemoveFromText(text);
    
    if (response.readyToRemove) {
      response.review = {
        stillAffectsUser: false,
        reasonCategory: 'ready_to_release',
        nextReflectionDays: null
      };
    } else {
      const reflectionDays = extractReflectionDaysFromText(text);
      if (reflectionDays) {
        response.review = {
          stillAffectsUser: true,
          reasonCategory: 'unclear',
          nextReflectionDays: reflectionDays
        };
      }
    }
    
    console.log('[AI CHAT] Plain-text review response - readyToRemove:', response.readyToRemove);
  }
  
  return response;
}

// MiniMax function calling tool definition for pinning mode
const MINIMAX_PINNING_TOOL = {
  name: 'submit_pinning_response',
  description: 'Return the complete StabIt pinning reply and structured analysis. For pinning mode, always call this function instead of responding with ordinary text.',
  parameters: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'The complete natural Chinese reply shown to the user.'
      },
      readyToPin: {
        type: 'boolean'
      },
      readyToRemove: {
        type: 'boolean'
      },
      coreIssue: {
        type: 'string',
        description: 'Specific record title. Empty only when no concrete event has been provided.'
      },
      reflectionDays: {
        type: 'integer',
        minimum: 0,
        maximum: 365
      },
      warmExplanation: {
        type: 'string'
      },
      currentGuides: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 3
      }
    },
    required: [
      'reply',
      'readyToPin',
      'readyToRemove',
      'coreIssue',
      'reflectionDays',
      'warmExplanation',
      'currentGuides'
    ],
    additionalProperties: false
  }
};

/**
 * Parses MiniMax tool call response for pinning mode
 * Extracts function arguments from choices[0].message.tool_calls[0].function.arguments
 * Returns the standard response shape or null if no valid tool call
 */
function parseToolCallPinningResponse(data) {
  if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    return null;
  }
  
  const message = data.choices[0]?.message;
  if (!message || !message.tool_calls || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
    return null;
  }
  
  const toolCall = message.tool_calls[0];
  if (!toolCall?.function?.arguments) {
    return null;
  }
  
  console.log('[MINIMAX TOOL CALL] Tool call received:', toolCall.function.name);
  
  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.warn('[MINIMAX TOOL CALL] Failed to parse function arguments:', e.message);
    return null;
  }
  
  console.log('[MINIMAX TOOL CALL] Parsed function arguments:', JSON.stringify(args).substring(0, 300));
  
  // Validate required fields
  if (typeof args.reply !== 'string' || !args.reply.trim()) {
    console.warn('[MINIMAX TOOL CALL] Missing or empty reply');
    return null;
  }
  
  if (typeof args.readyToPin !== 'boolean' || typeof args.readyToRemove !== 'boolean') {
    console.warn('[MINIMAX TOOL CALL] Booleans missing or wrong type');
    return null;
  }
  
  const reflectionDays = parseInt(args.reflectionDays, 10);
  if (isNaN(reflectionDays) || reflectionDays < 0 || reflectionDays > 365) {
    console.warn('[MINIMAX TOOL CALL] Invalid reflectionDays:', args.reflectionDays);
    return null;
  }
  
  // currentGuides validation: allow 0-3 when readyToPin=true or readyToPin=false
  if (!Array.isArray(args.currentGuides)) {
    console.warn('[MINIMAX TOOL CALL] currentGuides must be an array');
    return null;
  }
  if (args.readyToPin && args.currentGuides.length > 3) {
    console.warn('[MINIMAX TOOL CALL] currentGuides has too many items when readyToPin=true, got:', args.currentGuides.length);
    return null;
  }
  
  // Build the standard response shape
  const response = {
    reply: args.reply,
    readyToPin: args.readyToPin,
    readyToRemove: args.readyToRemove
  };
  
  // Only include analysis when readyToPin=true (complete pinning data)
  // For early chat (readyToPin=false), don't expose incomplete analysis fields
  if (args.readyToPin) {
    response.analysis = {
      safe: true,
      coreIssue: typeof args.coreIssue === 'string' ? args.coreIssue : '',
      reflectionDays: reflectionDays,
      warmExplanation: typeof args.warmExplanation === 'string' ? args.warmExplanation : '',
      currentGuides: args.currentGuides.filter(g => typeof g === 'string')
    };
  }
  
  console.log('[MINIMAX TOOL CALL] Successfully parsed tool call response');
  return response;
}

function buildMinimaxChatBody(modelId, mode, messages, pin, memoryContext = null) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const memoryMessage = memoryContext ? {
    role: 'system',
    content: memoryContext
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
  }
  if (memoryMessage) {
    allMessages.push(memoryMessage);
  }
  allMessages.push(...messages);

  const body = {
    model: modelId,
    messages: allMessages,
    temperature: 0.4
  };

  // For pinning mode, add function calling tool
  if (mode === 'pinning') {
    body.tools = [{
      type: 'function',
      function: {
        name: MINIMAX_PINNING_TOOL.name,
        description: MINIMAX_PINNING_TOOL.description,
        parameters: MINIMAX_PINNING_TOOL.parameters
      }
    }];
    body.tool_choice = 'auto';
  }

  return body;
}

function getMinimaxApiKey() {
  return process.env.MINIMAX_API_KEY || 
         process.env.MINIMAX_KEY || 
         process.env.MINIMAX_TOKEN || 
         process.env.MINI_MAX_API_KEY;
}

async function callMinimaxChat(mode, messages, pin, requestId = '', attempt = 1, deadlineMs = null, memoryContext = null) {
  const startTime = Date.now();
  const apiKey = getMinimaxApiKey();
  const modelId = process.env.MINIMAX_MODEL_ID;
  const apiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/v1';

  // Compute attempt timeout from budget
  const remainingMs = deadlineMs ? Math.max(5000, deadlineMs - Date.now()) : AI_FIRST_ATTEMPT_TIMEOUT_MS;
  const attemptTimeoutMs = attempt === 1
    ? Math.min(AI_FIRST_ATTEMPT_TIMEOUT_MS, remainingMs)
    : Math.min(remainingMs, AI_FIRST_ATTEMPT_TIMEOUT_MS);

  aiLog('attempt', 'minimax', { id: requestId, attempt, timeoutMs: attemptTimeoutMs });

  if (!apiKey || !modelId) {
    aiLog('provider', 'minimax missing config', { id: requestId, durationMs: 0 });
    return fallbackResponseForReason(mode, 'minimax_missing_api_key_or_model_id', requestId);
  }

  const body = buildMinimaxChatBody(modelId, mode, messages, pin, memoryContext);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      aiLog('provider', 'minimax timeout', { id: requestId, timeoutMs: attemptTimeoutMs });
      controller.abort();
    }, attemptTimeoutMs);
    
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    aiLog('provider', 'minimax response', { id: requestId, status: response.status, durationMs });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return fallbackResponseForReason(mode, `minimax_http_${response.status}:${errorBody.substring(0, 80)}`, requestId);
    }

    const data = await response.json();

    // PINNING MODE: Check for tool call first
    if (mode === 'pinning') {
      const toolCallResponse = parseToolCallPinningResponse(data);
      
      if (toolCallResponse) {
        aiLog('parse', 'minimax tool_call', { id: requestId, valid: true, durationMs });
        return toolCallResponse;
      }
      
      // No tool call found - retry with tool-only reminder if budget allows
      const retryRemainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
      if (retryRemainingMs > AI_RETRY_MIN_REMAINING_MS) {
        aiLog('attempt', 'minimax tool retry', { id: requestId, attempt: attempt + 1 });
        
        const retryBody = buildMinimaxChatBody(modelId, mode, messages, pin, memoryContext);
        retryBody.messages.push({
          role: 'user',
          content: '必须调用 submit_pinning_response。不要直接输出普通文本。'
        });
        
        const retryController = new AbortController();
        const retryTimeoutMs = Math.min(retryRemainingMs - 5000, AI_FIRST_ATTEMPT_TIMEOUT_MS);
        const retryTimeoutId = setTimeout(() => retryController.abort(), retryTimeoutMs);
        
        const retryResponse = await fetch(`${apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(retryBody),
          signal: retryController.signal
        });
        
        clearTimeout(retryTimeoutId);
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryToolCallResponse = parseToolCallPinningResponse(retryData);
          
          if (retryToolCallResponse) {
            aiLog('parse', 'minimax tool_call retry', { id: requestId, valid: true, durationMs: Date.now() - startTime });
            return retryToolCallResponse;
          }
        }
      }
    }

    // Fall back to content parsing (tagged/JSON/plain-text)
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackResponseForReason(mode, 'minimax_missing_content', requestId);
    }

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    const parsedResponse = parseAndValidateResponse(cleanContent, mode);
    
    if (parsedResponse) {
      aiLog('parse', 'minimax content', { id: requestId, valid: true, durationMs: Date.now() - startTime });
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'minimax_invalid_response_shape', requestId);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error.name === 'AbortError';
    return fallbackResponseForReason(mode, isTimeout ? 'minimax_timeout' : `minimax_exception:${error.message}`, requestId);
  }
}

async function callAIChatWithFallback(mode, messages, pin, requestId = '', deadlineMs = null, memoryContext = null) {
  const provider = process.env.AI_PROVIDER || 'doubao';
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'none';
  
  aiLog('start', 'callAIChatWithFallback', { id: requestId, mode, provider, fallbackProvider, budgetMs: deadlineMs ? deadlineMs - Date.now() : 'none' });

  let result;
  let usedFallback = false;
  let retried = false;

  if (provider === 'minimax') {
    result = await callMinimaxChat(mode, messages, pin, requestId, 1, deadlineMs, memoryContext);
    
    if (!validateChatResponse(result).valid) {
      const shouldRetry = isRetryableReason(result.fallbackReason);
      const remainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
      const hasBudgetForRetry = remainingMs > AI_RETRY_MIN_REMAINING_MS;
      const isConfigError = isNonRetryableConfigError(result.fallbackReason);
      
      // Same-provider retry: only for transient errors with sufficient budget
      if (shouldRetry && !retried && hasBudgetForRetry && !isConfigError) {
        aiLog('attempt', 'minimax retry', { id: requestId, attempt: 2, remainingMs });
        retried = true;
        result = await callMinimaxChat(mode, messages, pin, requestId, 2, deadlineMs, memoryContext);
      } else if (isConfigError) {
        aiLog('attempt', 'minimax no retry (config error)', { id: requestId, rawReason: result.fallbackReason });
      } else if (!shouldRetry) {
        aiLog('attempt', 'minimax no retry (non-retryable)', { id: requestId, rawReason: result.fallbackReason });
      } else if (!hasBudgetForRetry) {
        aiLog('attempt', 'minimax no retry (budget exhausted)', { id: requestId, remainingMs });
      }
      
      // Backup-provider fallback: evaluated independently of same-provider retry decision.
      // Auth/balance/config errors on MiniMax do NOT prevent an independently configured
      // Doubao fallback from running (if budget allows).
      if (!validateChatResponse(result).valid && fallbackProvider === 'doubao') {
        const fallbackRemainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
        if (fallbackRemainingMs > AI_RETRY_MIN_REMAINING_MS) {
          aiLog('attempt', 'doubao fallback', { id: requestId, remainingMs: fallbackRemainingMs });
          usedFallback = true;
          result = await callDoubaoChat(mode, messages, pin, requestId, 1, deadlineMs, memoryContext);
        } else {
          aiLog('attempt', 'doubao fallback skipped (budget exhausted)', { id: requestId, remainingMs: fallbackRemainingMs });
        }
      }
    }
  } else {
    result = await callDoubaoChat(mode, messages, pin, requestId, 1, deadlineMs, memoryContext);
    
    if (!validateChatResponse(result).valid) {
      const shouldRetry = isRetryableReason(result.fallbackReason);
      const remainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
      const hasBudgetForRetry = remainingMs > AI_RETRY_MIN_REMAINING_MS;
      const isConfigError = isNonRetryableConfigError(result.fallbackReason);
      
      if (shouldRetry && !retried && hasBudgetForRetry && !isConfigError) {
        aiLog('attempt', 'doubao retry', { id: requestId, attempt: 2, remainingMs });
        retried = true;
        result = await callDoubaoChat(mode, messages, pin, requestId, 2, deadlineMs, memoryContext);
      } else if (!shouldRetry) {
        aiLog('attempt', 'doubao no retry (non-retryable)', { id: requestId, rawReason: result.fallbackReason });
      } else if (!hasBudgetForRetry) {
        aiLog('attempt', 'doubao no retry (budget exhausted)', { id: requestId, remainingMs });
      }
    }
  }

  const validationResult = validateChatResponse(result);
  aiLog('end', 'callAIChatWithFallback', { id: requestId, provider, usedFallback, valid: validationResult.valid });
  
  return { result, usedFallback, provider };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const validation = validateChatRequest(req);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { mode, messages, pin, memoryContext } = req.body;

  // ── Request lifecycle tracking ──
  const requestId = generateRequestId();
  const handlerStartTime = Date.now();
  const deadlineMs = handlerStartTime + AI_TOTAL_BUDGET_MS;

  aiLog('start', 'handler', { id: requestId, mode, budgetMs: AI_TOTAL_BUDGET_MS, messagesCount: messages.length });
  if (memoryContext) {
    aiLog('memory', 'handler', { id: requestId, memoryContextLength: memoryContext.length });
  }

  // ── Single call with budget-aware retry/fallback ──
  // (callAIChatWithFallback now handles retry internally based on budget and error type)
  const { result, usedFallback, provider } = await callAIChatWithFallback(mode, messages, pin, requestId, deadlineMs, memoryContext);

  // Apply repair layer before validation to fix common formatting issues
  const repairedResult = repairChatResponse(result, mode);

  // If still invalid after repair, use controlled fallback (no second full-length call)
  if (!validateChatResponse(repairedResult).valid) {
    aiLog('end', 'handler repair failed, using fallback', { id: requestId, mode });
    Object.assign(repairedResult, fallbackResponseForReason(mode, 'retry_failed', requestId));
  }

  // Use repaired result for final response
  Object.assign(result, repairedResult);

  // USER TIMELINE PRIORITY: Extract explicit timeline from user messages and override AI recommendation
  if (mode === 'pinning' && result.analysis && result.analysis.reflectionDays) {
    const latestUserMessage = messages
      .filter(m => m.role === 'user')
      .at(-1)?.content || '';

    const userTimelineDays = extractReflectionDaysFromText(latestUserMessage);
    aiLog('timeline', 'pinning user override', { id: requestId, extracted: userTimelineDays, previous: result.analysis.reflectionDays });
    
    if (userTimelineDays !== null) {
      result.analysis.reflectionDays = userTimelineDays;
    }
  }

  // REVIEW USER TIMELINE PRIORITY: Extract explicit timeline from latest user message and override review days
  if (mode === 'review') {
    const latestUserMessage = messages
      .filter(m => m.role === 'user')
      .at(-1)?.content || '';

    const userTimelineDays = extractReflectionDaysFromText(latestUserMessage);
    aiLog('timeline', 'review user override', { id: requestId, extracted: userTimelineDays });

    if (userTimelineDays !== null && userTimelineDays >= 1 && userTimelineDays <= 365) {
      // Ensure result.review is an object
      if (!result.review || typeof result.review !== 'object') {
        result.review = {};
      }

      // Override both fields so frontend priority chain receives the user's explicit choice
      result.review.nextReflectionDays = userTimelineDays;
      result.reviewDays = userTimelineDays;
    }
  }

  // CORE ISSUE STABILITY: Preserve previous valid coreIssue when new one is unusable
  if (mode === 'pinning' && result.analysis) {
    const newCoreIssue = result.analysis.coreIssue;
    
    // Check if new coreIssue is unusable
    if (!isUsableCoreIssue(newCoreIssue)) {
      // Look for previous usable coreIssue
      const previousCoreIssue = pin?.coreIssue || pin?.aiResult?.coreIssue;
      
      if (isUsableCoreIssue(previousCoreIssue)) {
        aiLog('coreIssue', 'preserved previous', { id: requestId });
        result.analysis.coreIssue = previousCoreIssue;
      } else if (result.readyToPin) {
        // No previous valid title and readyToPin=true with unusable title
        // Set readyToPin=false to prevent creating a bad pin
        aiLog('coreIssue', 'no valid title, forcing readyToPin=false', { id: requestId });
        result.readyToPin = false;
      }
    }
  }

  // CONSISTENCY VALIDATION: Ensure reply timeline matches structured days after user override
  ensureReplyTimelineConsistency(result, mode);

  // Attach requestId to response (not shown in chat UI)
  result.requestId = requestId;

  const totalMs = Date.now() - handlerStartTime;
  aiLog('end', 'handler', { id: requestId, outcome: result.debugFallback ? 'fallback' : 'success', durationMs: totalMs, provider, usedFallback });
  
  res.status(200).json(result);
}

// ── Test-safe exports ──────────────────────────────────────────────────
// Internal helpers exported only for deterministic unit testing.
// These do NOT expose secrets, prompts, or provider request bodies.
// The handler itself is tested via mocked fetch/request/response.
export const __testHelpers = {
  classifyFallbackReason,
  isRetryableReason,
  isNonRetryableConfigError,
  generateRequestId,
  aiLog,
  AI_LOG_ALLOWLIST,
  AI_FUNCTION_MAX_DURATION_MS,
  RESPONSE_RESERVE_MS,
  AI_TOTAL_BUDGET_MS,
  AI_FIRST_ATTEMPT_TIMEOUT_MS,
  AI_RETRY_MIN_REMAINING_MS,
  FALLBACK_RESPONSES,
  fallbackResponseForReason,
  extractReflectionDaysFromText,
  isUsableCoreIssue
};
