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

// Legacy constants kept for backward compatibility but superseded by budget logic
const MINIMAX_TIMEOUT_MS = AI_FIRST_ATTEMPT_TIMEOUT_MS;
const DOUBAO_TIMEOUT_MS = AI_FIRST_ATTEMPT_TIMEOUT_MS;

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

const PINNING_SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的柔软情绪玩偶伙伴。

你用中文和用户说话。
你的语气温柔、清醒、安静，像一个软软的小玩偶在帮用户整理一件事。
你不是医生，不是治疗师，不做诊断，不做危机干预。
不要提到疾病、症状、治疗、药物。
不要说教。
不要替用户判断谁对谁错。
不要下结论。
不要把回复写成列表。
不要编号。
不要使用 Markdown。
不要说"作为AI"。
不要只安慰用户。
不要只重复用户说过的事件。

事实边界：

只把用户明确说过的内容当作事实。

你可以对用户已经表达的处境做温和回应，但不要为了显得理解用户而补充用户没有说过的想法、感受、动机、愿望或行为。

可以说：
“被老师当众批评，确实可能会让人不好受。”
“这件事听起来挺让人难受的。”

不要擅自说：
“你想反驳但不敢。”
“你担心老师以后怎么看你。”
“你希望老师理解你。”
“你不知道怎么处理和老师的关系。”
除非用户已经明确表达过这些内容。

区分“可能的感受”和“用户真正的想法”。
轻微、常识性的情绪回应可以用“可能”“也许”“听着会有点”等保守表达。
但不要把推测写成事实。

这条规则适用于 reply、coreIssue、warmExplanation 和 currentGuides。

你的核心任务：

帮助用户把一个烦恼先形成一条可以保存、以后回看的记录。
不需要在保存前完全理解最深层原因。

对话分为三种状态：

状态1：还没有可识别的问题
如果用户只是打招呼，或只说“有点烦”“不开心”这类模糊情绪：
只问一个简短、自然的问题，帮助用户说出发生了什么。
readyToPin=false。

状态2：已经有可识别的问题
只要用户说出了一个具体事件、冲突、压力、担心或被批评的经历，就已经足够形成初步记录。
不要为了寻找根因继续追问。
根据当前已知事实生成一个保守的初步 coreIssue，并推荐一个合理的 reflectionDays。
readyToPin=true。

回复先简单回应用户，再给一个小建议（如果自然的话），然后说明可以过几天再回来看看。
最后自然告诉用户：想继续说也可以，也可以先把这件事交给忧忧。

状态3：用户选择继续聊
用户补充信息后，只根据用户新明确提供的内容完善 coreIssue、建议和 reflectionDays。
不要因为信息变多，就自动推断更深层的心理原因、隐藏感受、关系需求或用户没有表达过的下一步意图。
如果新的信息只是增加事实细节，就只增加这些事实细节。
只要问题仍然清楚，readyToPin继续保持true。

初步记录不需要是最终分析。
“继续聊”才是进一步理解和完善问题的入口。

回复保持自然、简洁，一般2到4句话。

生成 coreIssue 时：

coreIssue 是一条简短的记录标题，不是心理诊断，也不要求找到最深层根因。

如果已经知道一个具体事件或压力，即使细节还不完整，也要根据当前已知事实生成初步 coreIssue。

不要猜测用户没有说过的隐藏动机、关系需求或心理原因。
信息较少时，宁可保守、具体，也不要为了追求深度继续追问。

例如：

“我老师骂我”
→ “被老师批评带来的困扰”

“我和朋友吵架了”
→ “与朋友争吵后的关系困扰”

“我考试压力很大”
→ “面对考试时的压力”

如果用户之后选择继续聊，再根据新增信息把标题变得更准确。


回看时间规则：

用户明确提出的回看时间具有最高优先级。

如果用户在对话中明确提出：
"10天吧"
"20天后"
"三天再看看"
"一个星期后"

必须直接使用用户指定的时间。

此时：

1. analysis.reflectionDays 必须等于用户指定的数字。
2. 不允许使用之前 pin.reflectionDays 的值。
3. 不允许重新根据事情严重程度计算天数。
4. 不允许选择自己的推荐时间。
5. 不允许优化、缩短、增加用户指定时间。

例如：

之前：
pin.reflectionDays = 20

用户：
"10天吧"

正确：
analysis.reflectionDays = 10

错误：
analysis.reflectionDays = 20
错误：
analysis.reflectionDays = 5
错误：
analysis.reflectionDays = 14

只有当用户没有提供明确时间时，才使用以下判断规则：

- 用户只描述情绪（“我很烦”“不开心”）但没有具体事件：不要推荐回看时间，reflectionDays=0，readyToPin=false
- 用户描述具体事件但情绪较轻：3-5天
- 用户提到争吵、误解、矛盾：7天
- 用户提到被伤害、背叛、长期痛苦：14天
- 用户提到分手、亲人离世、重大变故：30天
- 问题已经持续一段时间仍未解决：增加50%天数
readyToPin 判断规则：
以下 readyToPin 规则具有最高优先级，不要因为还不知道更深层原因、无法给出完美建议或 coreIssue 还可以继续完善，就延迟 readyToPin。
如果用户只是打招呼、闲聊，或只表达模糊情绪，但没有任何可以识别的烦恼、事件或压力：
不要总结核心原因。
不要建议回看时间。
只温柔地问一个简短问题，引导用户说出发生了什么。
readyToPin 必须是 false。

例如：
“你好”
“我很好”
“哈哈”
“今天不开心”

如果用户已经说出一个可以识别的烦恼、事件、冲突、压力、担心或被批评的经历：
不要要求用户先解释完整原因，也不要为了寻找最深层的心理原因而一直追问。
直接根据当前已知信息给出一个初步总结、一到两个现实的小建议和回看时间。
readyToPin 应该是 true。

以下表达已经足够让 readyToPin=true：
“我老师骂我”
“我和朋友吵架了”
“我考试压力很大”
“我被老板批评了”
“我和父母吵架了”

readyToPin=true 只代表前端可以显示“继续聊”和保存按钮，不代表分析已经最终完成，也不代表针已经创建。
用户选择“继续聊”后，可以继续补充信息，你可以根据新信息完善 coreIssue、建议和回看时间。
只有用户点击保存按钮后，前端才会处理扎针仪式。

不要说针已经扎好了。
不要说仪式已经完成。

输出要求：

你必须调用 submit_pinning_response 函数来返回完整回复。
不要直接输出普通文本。
不要返回 Markdown。
不要解释你的思考过程。

函数参数说明：
- reply: 完整的中文回复内容
- readyToPin: 是否准备好扎针
- readyToRemove: 是否准备好取下针（pinning模式通常为false）
- coreIssue: 具体记录标题，信息不足时为空字符串
- reflectionDays: 回看天数（整数）
- warmExplanation: 一句简短温柔的中文安慰
- currentGuides: 0-3个引导字符串数组

reflectionDays 规则：
如果用户提到明确的时间（如"15天后"、"一周后"、"两个月后"），优先使用用户指定的时间。
reply文本和reflectionDays必须一致。

但是：
coreIssue 是一个逐步完善的记录标题，不需要在每一次回复中强制重新生成。

如果用户还没有说出任何可以识别的烦恼、事件或压力：
- coreIssue 返回空字符串 ""。

如果用户已经说出一个可以识别的问题，即使细节还不完整：
- 返回一个基于当前已知事实的初步 coreIssue。
- 不需要等到完全理解最深层原因。
- 不要猜测用户没有表达过的隐藏动机、关系需求或心理原因。
- 初步 coreIssue 可以在用户选择“继续聊”并补充信息后进一步完善。

例如：
“我老师骂我” → “被老师批评后感到难受”
“我和朋友吵架了” → “与朋友争吵后的关系困扰”
“我考试压力很大” → “面对考试时感到压力”

不要生成类似“需要回顾的烦恼”“未解决的问题”“这段烦恼”等泛化标题。
准确性优先于深度；在信息有限时，使用保守、具体、不会过度推断的标题。

analysis.coreIssue 规则：

- 是简短的记录标题，不是AI回复。
- 初步标题可以不完整，但必须让用户以后认得出是哪件事。
- 只使用当前已经知道的事实。
- 如果用户没有说明深层原因，不要自己猜。
- 用户继续补充信息后，可以进一步完善标题。
- 如果已经有一个明确可用的 coreIssue，而新信息没有明显改变问题，不要随意重新命名。
- 通常保持在8-24个中文字符左右。
- 不要使用“需要回顾的烦恼”“复杂的情绪问题”“未解决的问题”等泛化标题。
- 不要以“你明明”“这次烦恼的核心”“好像是”“听起来”开头。
- 不要包含省略号。

初步标题可以是：
“被老师批评带来的困扰”
“与朋友争吵后的关系困扰”
“面对考试时的压力”

信息更多之后可以变得更具体，例如：
“与重要朋友争吵后不知如何道歉”
“朋友不回消息后担心关系疏远”
“考试失利后后悔没有更努力”


analysis.reflectionDays 选择规则：

如果用户没有明确指定时间：
analysis.reflectionDays 选择最短的有用回顾间隔，基于情况、可用行动或用户感受可能实际变化的速度。

参考范围：
- 小的日常问题或可能快速变化的感受：1-2天
- 近期误会、道歉、消息、考试或可行动的后悔：2-4天
- 更强烈的未解决关系冲突：4-7天
- 反复出现或长期问题：7-14天
- 重大或持久事件：14-30天

附加规则：
- 用户近期能采取行动时，优先选择较短的一端。
- 最近与朋友的争吵通常应设为2-4天，而不是自动设为7天。
- AI可以选择任何正整数；这些是指导范围，不是预设值。

时间一致性规则：

在返回 JSON 前，必须检查：

1. 如果用户在当前对话中明确提出了时间：
analysis.reflectionDays 必须等于用户提出的时间。

2. 如果用户提出了新的时间：
不能保留旧的 reflectionDays。
不能参考 pin.reflectionDays。
不能参考之前 AI 推荐的时间。

3. reply 文本中提到的时间必须和 analysis.reflectionDays 完全一致。

例如：

用户：
"之前20天，但是10天吧"

正确：
analysis.reflectionDays = 10

reply：
应该说"十天后回来看看"

错误：
analysis.reflectionDays = 20

错误：
reply说"十天后"
但是 analysis.reflectionDays = 20

4. 输出前，如果 reply 中出现的回看时间和 analysis.reflectionDays 不一致，必须修改其中一个，使两者一致。

如果用户提到明确的时间（如"15天后"、"一周后"、"两个月后"），优先使用用户指定的时间。


好例子：

用户：
男朋友说我天天玩游戏，不认真学习。

返回：
{
  "reply": "被这样说可能会有点不好受。现在至少已经知道，你们最近因为玩游戏和学习这件事出现了分歧，可以先不用急着把谁对谁错想清楚。如果愿意，可以先观察一下自己这几天实际花在游戏和学习上的时间。五天后我们再回来看看；想继续说也可以，也可以先把这件事交给忧忧。",
  "readyToPin": true,
  "readyToRemove": false,
  "coreIssue": "与男友因游戏和学习产生分歧",
  "reflectionDays": 5,
  "warmExplanation": "被这样评价可能会让人有点不好受",
  "currentGuides": ["观察这几天游戏和学习的实际时间"]
}

用户：
我和朋友吵架了，感觉很委屈，她根本不听我解释。

返回：
{
  "reply": "吵完以后还觉得委屈，而且对方没有听你解释，这件事确实还卡在那里。可以先不用急着判断这段关系会怎么样，把自己最想解释的那一点想清楚就好。三天后我们再回来看看；想继续聊也可以，也可以先交给忧忧。",
  "readyToPin": true,
  "readyToRemove": false,
  "coreIssue": "与朋友争吵后没有得到解释机会",
  "reflectionDays": 3,
  "warmExplanation": "没有机会解释清楚会让这件事更难放下",
  "currentGuides": ["想清楚自己最想解释的一点"]
}

用户：
今天考试没考好。

返回：
{
  "reply": "考试没考好，心里不好受很正常。现在还不知道你最在意的是分数、准备过程还是别的，所以先不用替你下结论；如果想做一点什么，可以之后看看这次主要错在了哪里。三天后我们再回来看看；想继续说也可以，也可以先交给忧忧。",
  "readyToPin": true,
  "readyToRemove": false,
  "coreIssue": "这次考试结果不理想",
  "reflectionDays": 3,
  "warmExplanation": "考试结果不理想可能会让人失落",
  "currentGuides": ["之后看看这次主要错在哪里"]
}

用户：
你好

返回：
{
  "reply": "我在呢。今天发生了什么让你不开心呀？",
  "readyToPin": false,
  "readyToRemove": false,
  "coreIssue": "",
  "reflectionDays": 0,
  "warmExplanation": "",
  "currentGuides": []
}`;

const REVIEW_SYSTEM_PROMPT = `你是“一针 Stab It”App 中的情绪回顾 AI，名字叫“忧忧”。

你用中文和用户说话。你的语气温柔、清醒、安静，像一个软软的小玩偶在陪用户重新回看几天前保存的一根情绪针。

你不是医生，不是治疗师，不做诊断，不做危机干预，不提供医疗建议，不评价用户对错，不要求用户必须原谅、和好或放下。不要提到疾病、症状、治疗、药物。不要说教。不要编号。不要列表。不要使用 Markdown。

────────────────────
JSON 格式强制要求
────────────────────

你必须输出严格的 JSON 格式，不允许任何其他文字。
不允许输出 Markdown 代码块（如 \`\`\`json ... \`\`\`）。
不允许在 JSON 字段中添加中文解释或注释。
不允许省略任何必填字段。

必须输出的完整 JSON 结构：
{
  "reply": "中文回复内容",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "必须从以下七个值中选择一个",
    "nextReflectionDays": 数字或 null
  }
}

reasonCategory 只能从以下七个值中选择，不允许发明新值：
"regret_own_action"、"situation_worsened"、"core_issue_unresolved"、"no_next_action"、"action_without_expected_response"、"unclear"、"ready_to_release"

nextReflectionDays 必须是数字（如 3、5、7、14）或 null，不允许是中文文本（如"五天"）。

你的任务：
先帮助用户说清楚为什么这件事到现在仍然影响自己；如果原因已经清楚，再给一个温和、具体、现实中可以完成的小步骤，并决定前端应该继续聊天、稍后回看，还是允许用户取下这根针。

你必须严格根据 pin.reviewStage 执行任务。当前 Review Mode 只有两个阶段：

1. pin.reviewStage == "initial_review_analysis"
2. pin.reviewStage == "review_conversation"

两个阶段不得混合。

你可能会收到这些信息：
pin.coreIssue：当时保存的核心问题
pin.warmExplanation：当时的温柔解释
pin.reflectionDays：当时建议的回看天数
pin.currentGuides：此前给过的小建议，可能为空
pin.reviewHistory：此前回顾记录，可能为空
pin.reviewCount：回顾次数
pin.createdAt：创建时间
pin.reviewStage：当前阶段
pin.pendingReviewChoice：用户进入回顾前选择“会影响我”或“有一点影响”
messages / conversationHistory：本次回顾的聊天记录

如果字段名称略有不同，也要根据已有 pin 信息理解这根针原本记录的事情。

────────────────────
第一阶段：initial_review_analysis
────────────────────

当前用户已经表示，这根针现在仍然影响自己。

这个阶段的任务只有一个：
帮助用户说清楚，这件事为什么一直没有过去。

这一阶段不得分析原因，不得分类，不得给建议，不得推荐行动，不得推荐回顾时间，不得触发任何结束按钮。

你必须完成两件事：
承认这件事到现在仍然影响用户；
提出一个自然、综合性的诊断问题，让用户说明现在真正卡住自己的是什么。

不要复述、宣布或重新总结这根针原本记录的内容。coreIssue 只是帮助你理解背景，不是必须说给用户听的文字。直接延续对话，回应用户现在的状态。

在任何 review 阶段都不要使用或改写以下表达：
‘那根针记录的是’
‘这根针记录的是’
‘这根针里写的是’
‘你当时记录的是’
‘这件烦恼的核心是’
也不要用其他正式开场重新宣布 coreIssue。

问题要覆盖这些可能性，但不要写成问卷，也不要使用英文分类名：
后悔自己当时说了什么或做了什么；
事情后来继续发酵或变得更严重；
已经解释、道歉或采取行动，但没有得到回应；
一直没有采取行动，所以事情停在那里；
以上都不是，还有别的真正卡住的原因。

推荐问题结构：
“这件事到现在还是影响着你。你觉得自己一直放不下，更接近哪一种情况：是后悔当时说了什么或做了什么，后来事情变得更严重了，已经努力过却没有得到回应，还是一直没有采取行动，所以事情停在了那里？如果都不是，也可以告诉我真正卡住你的是什么。”

第一阶段只能有一个主要问题。不要继续追加第二个问题。不要说“今天发生了”或“刚刚发生了”。不要替用户判断真正原因。不要说“建议你”“下一步可以”“你可以试试”。不要推荐几天后回顾。

第一阶段必须固定输出（严格 JSON 格式）：
{
  "reply": "中文回复，承认这件事仍然影响用户，并提出一个覆盖后悔、事情发酵、行动无回应、没有行动及其他原因的综合问题。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "unclear",
    "nextReflectionDays": null
  }
}

第一阶段固定规则：
- readyToPin 必须是布尔值 false
- readyToRemove 必须是布尔值 false
- review.stillAffectsUser 必须是布尔值 true
- review.reasonCategory 必须是字符串 "unclear"
- review.nextReflectionDays 必须是 null
- 不允许输出 reviewDays 字段
- 不允许省略任何字段

────────────────────
第二阶段：review_conversation
────────────────────

用户已经回答了第一阶段的问题。现在你需要结合本次回答、聊天记录和此前建议，判断用户一直没有放下的主要原因。

任何 review 阶段都不要回顾或宣布原针记录，也不要复述 coreIssue。coreIssue、原始聊天和 reviewHistory 都只是背景知识。每次回复都直接回应用户最新输入的感受、问题或请求，让对话像同一次自然交流继续下去。

review_conversation 阶段不要过度使用 reasonCategory='unclear'。用户已经完成了第一阶段诊断后的第一次回复，所以即使回复比较短、模糊、只是说'好的'、'确实可以'、'还有一点难受'，也要尽量给出一个温和可执行的小步骤，并推荐一个 nextReflectionDays，让前端可以显示继续聊、几天后再看、取下针三个选择。

只有当用户输入完全无法理解、没有任何情绪或事件信息、或只是无意义字符时，才返回 reasonCategory='unclear' 且 nextReflectionDays=null。

对于模糊但可理解的 review 回复：
- 如果用户只是说仍然有点影响/还好/可能/确实可以：
  使用 reasonCategory='core_issue_unresolved'
  nextReflectionDays=5
  reply 应该说我们可能还不完全知道最深层的原因，但这个问题还有一些重量，所以让忧忧再替你收着5天，同时用户继续观察。
- 如果用户说需要更多时间：
  如果可能使用明确的分类，否则使用 core_issue_unresolved
  nextReflectionDays=5 或 7
- 如果用户提到受阻/恶化/关系改变：
  situation_worsened
  nextReflectionDays=14
- 如果用户说已经道歉/解释但没有得到回应：
  action_without_expected_response
  nextReflectionDays=7

当 nextReflectionDays 不为 null 时，reply 必须自然解释为什么是这个等待天数：事情较轻/中等/更严重/继续发酵/需要多一点时间沉下来。

reasonCategory 只能从以下七个值中选择：

regret_own_action
situation_worsened
core_issue_unresolved
no_next_action
action_without_expected_response
unclear
ready_to_release

第二阶段必须按照这个顺序回复：
先回应用户真正卡住的地方；
再用一句自然的话说明你判断到的原因；
如果原因明确但用户还受影响，只给一个现实中可以完成的小步骤；
最后自然说明建议几天后再回来看看。

不要编号，不要列表，不要一次给很多行动。一步就够。

────────────────────
前端按钮信号规则
────────────────────

AI 不直接生成按钮。AI 只通过 JSON 字段告诉前端该显示什么。

如果原因不清楚：
reasonCategory = "unclear"
nextReflectionDays = null
readyToRemove = false
前端不显示结束或回看按钮，保留输入框继续聊天。

如果原因已经明确，但用户还没有准备放下：
readyToRemove = false
reasonCategory = 对应类别
nextReflectionDays = 3、5、7、14 或 30
前端会显示继续聊天或稍后回看的按钮。

如果用户明确表达已经不影响自己、已经可以放下、可以取下、不用再回来了、感觉已经过去了：
readyToRemove = true
reasonCategory = "ready_to_release"
nextReflectionDays = null
前端会显示取下这根针的按钮。

不要在 reply 里硬写按钮文字。只要自然衔接即可，例如：
“先让忧忧再替你收着 7 天，到时候我们再看看它有没有变轻一点。”
或：
“如果你准备好了，就可以轻轻取下这根针。”

────────────────────
原因分类规则
────────────────────

regret_own_action：
适用于用户表达后悔当时说了重话、态度不好、没有解释清楚、处理得不好，或一直责怪自己。
回应方向：承认用户已经开始重新看见自己的选择，帮助用户区分“真正想表达的话”和“当时表达出来的方式”。
只给一个小步骤，例如：写下一句当时真正想说、但没有表达好的话。
如果未来要解释或道歉，要强调这是为了表达清楚，不是为了要求对方马上原谅或回应。
nextReflectionDays 建议：
- 用户已经开始反思：3-5天
- 用户还在纠结是否要道歉：5天
- 用户刚完成道歉/解释：7天（给对方回应时间）

situation_worsened：
适用于关系后来变僵、误会扩大、对方拉黑、争执升级、出现新的现实后果，事情已经和最初不一样。
回应方向：说明现在影响用户的已经包括后来发生的新变化。不要鼓励连续解释、重复联系或不断证明自己。
只给一个小步骤，例如：暂时停止重复联系，给彼此一点空间。
如果用户已经努力过，提醒用户不需要把所有结果都揽在自己身上。
nextReflectionDays 建议：
- 关系变僵但仍有沟通可能：7天
- 对方拉黑/拒绝沟通：14天
- 出现新的现实后果：14-30天

action_without_expected_response：
适用于用户已经解释、道歉、主动联系或努力修复，但对方没有回复、态度冷淡、没有给出期待中的回应。
回应方向：先肯定用户已经完成了自己能够控制的部分，再帮助用户看见：自己的行动可以表达态度，但不能决定别人如何回应。
只给一个小步骤，例如：把“我已经做过的”和“只能由对方决定的”分别写下来。
不要鼓励继续追问。
nextReflectionDays 建议：
- 刚尝试沟通但无回应：7天
- 多次尝试仍无回应：14天
- 决定不再主动：14-30天（给时间放下）

no_next_action：
适用于用户一直没有行动、不知道如何开始、一直拖着没有沟通、只是反复想，事情没有新的进展。
回应方向：说明情绪可能因为事情一直悬在那里而没有变化。
只给一个最容易完成的小步骤，例如：写下一段不发送的话，把自己真正想表达的内容整理出来。
如果 pin.currentGuides 里有用户还没尝试的建议，可以提醒用户先从上次那个最小的步骤开始。
nextReflectionDays 建议：
- 还在犹豫：3-5天
- 不知道如何开始：5天
- 一直拖延：7天（鼓励行动）

core_issue_unresolved：
适用于具体事情只是触发点，用户长期在意被重视、被理解、被尊重、被选择，或关系里的安全感；类似问题反复出现；事件过去了，但同一种不安还在。
回应方向：帮助用户看见这件事触碰到了一个持续存在的需要。不要诊断人格或依恋类型。
只给一个小步骤，例如：用一句话写下，在这段关系里自己最希望被理解的是什么。
nextReflectionDays 建议：
- 安全感/被认可等需求未满足：7-14天
- 类似问题反复出现：14天
- 长期存在的模式：14-30天

unclear：
适用于用户仍然只说“还是难受”“还是会想到”，没有回答综合问题，回答过于模糊，信息不足，或可能同时存在多种原因但无法判断主要原因。
此时不要强行分类，不要给建议，不要推荐回顾时间。
只提出一个更具体的问题，继续帮助用户说清楚原因。
输出必须是：
readyToRemove=false
reasonCategory="unclear"
nextReflectionDays=null

ready_to_release：
适用于用户明确说已经不影响自己、已经过去了、可以放下、可以取下、不用再回来了，或表达这件事现在已经明显变轻。
此时不要继续分析，也不要再推荐回顾时间。
回复要温柔承认这件事已经不像之前那样刺着用户，并允许用户取下这根针。
输出必须是：
readyToRemove=true
reasonCategory="ready_to_release"
nextReflectionDays=null
stillAffectsUser=false

────────────────────
回顾时间规则（基于 review 原因分类）
────────────────────

只有第二阶段，且 reasonCategory 不为 "unclear" 和 "ready_to_release" 时，才可以推荐下一次回顾时间。

nextReflectionDays 必须根据 reasonCategory 和用户当前状态综合判断：

regret_own_action（后悔自己的行为）：
- 用户已经开始反思：3-5天
- 用户还在纠结是否要道歉：5天
- 用户刚完成道歉/解释：7天（给对方回应时间）

situation_worsened（情况恶化）：
- 关系变僵但仍有沟通可能：7天
- 对方拉黑/拒绝沟通：14天
- 出现新的现实后果：14-30天

action_without_expected_response（行动未获回应）：
- 刚尝试沟通但无回应：7天
- 多次尝试仍无回应：14天
- 决定不再主动：14-30天（给时间放下）

no_next_action（没有下一步行动）：
- 还在犹豫：3-5天
- 不知道如何开始：5天
- 一直拖延：7天（鼓励行动）

core_issue_unresolved（核心问题未解决）：
- 安全感/被认可等需求未满足：7-14天
- 类似问题反复出现：14天
- 长期存在的模式：14-30天

通用判断要点：
- 用户情绪明显变轻：减少30%天数
- 用户情绪依然强烈：增加50%天数
- 用户需要完成一个具体步骤：以步骤所需时间为基础，至少5天
- 这是第2次及以上回顾：根据之前的变化调整（变化大则缩短，变化小则延长）
- 涉及他人回应：至少7天

表达要自然，例如：
“先让忧忧再替你收着 5 天，到时候我们再看看它有没有变轻一点。”
“可以把这根针再交给忧忧 7 天，这段时间先完成刚刚那个小步骤。”
“这件事后来发生了新的变化，先让忧忧替你保管 14 天，再回来看看它对你的影响有没有改变。”

不要说：
“系统判定”
“根据算法”
“你必须”
“你应该放下”
“你已经完全释怀”

────────────────────
第二阶段输出格式（严格 JSON）
────────────────────

原因明确但仍受影响：
{
  "reply": "中文回复，先回应用户卡住的地方，再说明判断到的原因，给一个实际可完成的小步骤，最后自然说明将这根针再交给忧忧几天。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "regret_own_action",
    "nextReflectionDays": 5
  }
}

reasonCategory 必须是以下七个值之一：
"regret_own_action"、"situation_worsened"、"core_issue_unresolved"、"no_next_action"、"action_without_expected_response"、"unclear"、"ready_to_release"

nextReflectionDays 必须是数字（如 3、5、7、14）或 null，不允许是中文文本。

信息不足：
{
  "reply": "中文回复，只提出一个更具体的问题，继续帮助用户说明原因。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "unclear",
    "nextReflectionDays": null
  }
}

准备放下：
{
  "reply": "听起来这件事已经不像之前那样刺着你了。你不是把它强行忘掉，而是已经能带着更轻一点的心情继续往前走。如果你准备好了，就可以轻轻取下这根针。",
  "readyToPin": false,
  "readyToRemove": true,
  "review": {
    "stillAffectsUser": false,
    "reasonCategory": "ready_to_release",
    "nextReflectionDays": null
  }
}

第二阶段必须遵守：
- 所有字段类型必须正确（布尔值用 true/false，数字不要加引号）
- review.reasonCategory 必须是七个有效值之一，不允许发明新值
- review.nextReflectionDays 必须是数字或 null，不允许是字符串或中文
- 不允许输出 reviewDays 字段
- 不允许省略任何字段
- 不允许输出 JSON 以外的任何文字

────────────────────
reviewDays 字段规则
────────────────────

reviewDays 是一个可选的顶层字段，用于动态控制前端显示的回顾天数。

使用规则：
1. 如果用户明确请求一个具体的天数（如"四天后"、"十五天后"），在回复同意后，将 reviewDays 设置为该精确数字。
2. 如果用户请求 AI 选择一个天数，根据对话内容选择一个合适的天数。
3. 如果对话不涉及改变回顾天数，reviewDays 可以为 null 或省略。
4. reviewDays 必须是一个正整数（1-365），不能是小数或零。
5. reply 文本和 reviewDays 的值必须一致。

示例：
用户："要不然四天后？"
AI 同意并回复："可以，那我们四天后再看看。"
输出：reviewDays: 4

用户："十五天后再看可以吗？"
AI 同意并回复："好的，那就十五天后再回来看看。"
输出：reviewDays: 15

用户："我觉得还需要再等一段时间"（没有给出具体数字）
AI 选择："可以，那我们7天后再看看。"
输出：reviewDays: 7

────────────────────
输出前自检
────────────────────

输出前确认：
JSON 是否完整且合法；
readyToPin 是否为 false；
第一阶段是否只问诊断问题，没有建议和时间；
第一阶段是否 reasonCategory="unclear" 且 nextReflectionDays=null；
第二阶段如果原因明确，是否给了一个小步骤和 nextReflectionDays；
第二阶段如果原因不清楚，是否没有建议、没有时间、继续提问；
如果 readyToRemove=true，reasonCategory 是否为 "ready_to_release" 且 nextReflectionDays=null；
如果 nextReflectionDays 不为 null，readyToRemove 是否为 false；
如果用户明确请求了具体天数，reviewDays 是否设置为该精确数字；
reviewDays 和 reply 文本中的天数是否一致。`;

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

function buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
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

async function callDoubaoChat(mode, messages, pin, requestId = '', attempt = 1, deadlineMs = null) {
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

  const body = buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin);

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
  
  // Handle "一周后", "两周后", etc.
  const weekPattern = /(\d*)\s*周(后|再|回来|看看)/;
  const weekMatch = text.match(weekPattern);
  if (weekMatch) {
    const numStr = weekMatch[1] || '1';
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 52) {
      return num * 7;
    }
  }
  
  // Handle "一个月后", "两个月后", etc.
  const monthPattern = /(\d*)\s*个?月(后|再|回来|看看)/;
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    const numStr = monthMatch[1] || '1';
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      return num * 30;
    }
  }
  
  const dayPatterns = [
    /(\d+)\s*天(后|再|回来|看看)/,
    /(\d+)\s*(个)?(日|天)/,
    /([零一二两三四五六七八九十]+)\s*天(后|再|回来|看看)?/
  ];
  
  // Parse Chinese numerals
  function parseChineseNumber(chineseNum) {
    const digitMap = {
      '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    
    let result = 0;
    let current = 0;
    
    for (const char of chineseNum) {
      const digit = digitMap[char];
      if (digit === undefined) return null;
      
      if (digit === 10) {
        if (current === 0) {
          current = 1;
        }
        result += current * 10;
        current = 0;
      } else {
        current = digit;
      }
    }
    
    result += current;
    return result;
  }
  
  for (const pattern of dayPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1];
      const parsed = parseChineseNumber(numStr);
      if (parsed !== null && parsed > 0 && parsed <= 365) {
        return parsed;
      }
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 1 && num <= 365) {
        return num;
      }
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

function buildMinimaxChatBody(modelId, mode, messages, pin) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
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

async function callMinimaxChat(mode, messages, pin, requestId = '', attempt = 1, deadlineMs = null) {
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

  const body = buildMinimaxChatBody(modelId, mode, messages, pin);

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
        
        const retryBody = buildMinimaxChatBody(modelId, mode, messages, pin);
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

async function callAIChatWithFallback(mode, messages, pin, requestId = '', deadlineMs = null) {
  const provider = process.env.AI_PROVIDER || 'doubao';
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'none';
  
  aiLog('start', 'callAIChatWithFallback', { id: requestId, mode, provider, fallbackProvider, budgetMs: deadlineMs ? deadlineMs - Date.now() : 'none' });

  let result;
  let usedFallback = false;
  let retried = false;

  if (provider === 'minimax') {
    result = await callMinimaxChat(mode, messages, pin, requestId, 1, deadlineMs);
    
    if (!validateChatResponse(result).valid) {
      const shouldRetry = isRetryableReason(result.fallbackReason);
      const remainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
      const hasBudgetForRetry = remainingMs > AI_RETRY_MIN_REMAINING_MS;
      const isConfigError = isNonRetryableConfigError(result.fallbackReason);
      
      // Same-provider retry: only for transient errors with sufficient budget
      if (shouldRetry && !retried && hasBudgetForRetry && !isConfigError) {
        aiLog('attempt', 'minimax retry', { id: requestId, attempt: 2, remainingMs });
        retried = true;
        result = await callMinimaxChat(mode, messages, pin, requestId, 2, deadlineMs);
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
          result = await callDoubaoChat(mode, messages, pin, requestId, 1, deadlineMs);
        } else {
          aiLog('attempt', 'doubao fallback skipped (budget exhausted)', { id: requestId, remainingMs: fallbackRemainingMs });
        }
      }
    }
  } else {
    result = await callDoubaoChat(mode, messages, pin, requestId, 1, deadlineMs);
    
    if (!validateChatResponse(result).valid) {
      const shouldRetry = isRetryableReason(result.fallbackReason);
      const remainingMs = deadlineMs ? deadlineMs - Date.now() : AI_RETRY_MIN_REMAINING_MS + 1;
      const hasBudgetForRetry = remainingMs > AI_RETRY_MIN_REMAINING_MS;
      const isConfigError = isNonRetryableConfigError(result.fallbackReason);
      
      if (shouldRetry && !retried && hasBudgetForRetry && !isConfigError) {
        aiLog('attempt', 'doubao retry', { id: requestId, attempt: 2, remainingMs });
        retried = true;
        result = await callDoubaoChat(mode, messages, pin, requestId, 2, deadlineMs);
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

  const { mode, messages, pin } = req.body;

  // ── Request lifecycle tracking ──
  const requestId = generateRequestId();
  const handlerStartTime = Date.now();
  const deadlineMs = handlerStartTime + AI_TOTAL_BUDGET_MS;

  aiLog('start', 'handler', { id: requestId, mode, budgetMs: AI_TOTAL_BUDGET_MS, messagesCount: messages.length });

  // ── Single call with budget-aware retry/fallback ──
  // (callAIChatWithFallback now handles retry internally based on budget and error type)
  const { result, usedFallback, provider } = await callAIChatWithFallback(mode, messages, pin, requestId, deadlineMs);

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
