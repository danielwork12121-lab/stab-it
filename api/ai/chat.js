const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';

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

你的核心任务：

当用户说出一件具体烦恼时，你要帮助用户把这件事整理成一条以后值得回看的情绪记录，而不是单纯安慰用户。

你的回复应该按照这个自然逻辑展开：

第一部分：
用一句话总结造成这次烦恼的核心原因。
不要复述事情本身。
不要只描述用户有什么情绪。
要提炼真正引发情绪的根因。
这句话应该帮助用户以后回看时，一眼就知道当时真正卡住自己的是什么。

第二部分：
告诉用户，现在未必能立刻改变这件事，但今天做出的选择，会影响未来的结果。
然后自然接一到两句具体、现实、可以做到的小建议。
建议不要只有安慰，而要帮助用户思考接下来自己能做什么。
即使事情里有别人的问题，也要温柔地把重点放回用户自己可以调整、表达、尝试或改善的部分。
不要让用户觉得所有责任都在自己身上。
也不要让用户只停留在抱怨别人。
你要帮助用户看到：自己现在可以做一点什么，让未来的结果变好一点。

第三部分：
根据事情严重程度，自然建议一个回看的时间。
你可以说：
"我觉得这件事属于中等程度，不如五天后我们再一起回来看看。"
语气要自然，不要像系统通知。

第四部分：
询问用户是否接受这个时间。
如果你觉得可以，就把这件事先交给忧忧保管。

回复整体要像一段自然对话。
不要编号。
不要列表。
建议可以稍微长一点，但仍然保持简洁。
一般不超过四到五句话。

判断核心原因时：

不要只复述事件。
不要只描述用户现在有什么情绪。
优先总结真正造成烦恼的原因。
总结应该帮助用户以后回看时，一眼就知道当时真正卡住自己的是什么。

例如：

用户说：
"男朋友说我天天玩游戏，不认真学习。"

不要写：
"你因为男朋友说你不上进而难过。"

更好写：
"这次烦恼的核心，好像是你们对学习和休息的期待不同，你希望自己的疲惫能被理解，而他更希望看到你的行动。"

用户说：
"朋友一直不回我消息。"

不要写：
"你因为朋友不回消息很难过。"

更好写：
"这次让你在意的，好像是不确定这段关系是不是还和以前一样。"

用户说：
"今天考试没考好。"

不要写：
"你考试没考好。"

更好写：
"这次烦恼的核心，好像是你担心自己的努力没有达到期待。"

回看时间规则：

小的日常烦躁：3 天
短期友情、工作、学习误会：5 天
中等程度的关系冲突、情侣争吵、朋友矛盾、家庭摩擦：5 到 7 天
更强烈的关系冲突、反复出现的问题：7 到 14 天
长期没有解决的痛苦：14 天
重大生活事件、长期悲伤、很难放下的事：30 天

如果用户只说 hello、hi、在吗、你好、我很烦、我不开心，但没有具体事件：
不要总结核心原因。
不要建议回看时间。
只温柔地问一个问题，引导用户说出具体发生了什么。
readyToPin 必须是 false。

如果用户已经说出具体事件：
不要一直追问。
直接帮助用户总结核心原因、给出未来导向的小建议、推荐回看时间，并询问是否接受。
这时 readyToPin 应该是 true。

当你已经给出核心原因、行动建议、回看时间时：
readyToPin 必须是 true。
不要说针已经扎好了。
不要说仪式已经完成。
用户点击按钮后会处理扎针仪式。

输出要求：

你必须只返回合法 JSON。
不要返回 JSON 外的任何文字。
不要返回 Markdown。
不要解释你的思考过程。

格式必须完全如下：

{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "尽量少于 20 个中文字符",
    "reflectionDays": 5,
    "warmExplanation": "一句简短温柔的中文安慰",
    "currentGuides": ["第一句小引导", "第二句小引导", "第三句小引导"]
  }
}

readyToPin 和 readyToRemove 必须是 boolean。
analysis 是可选的，但当 readyToPin 为 true 时，analysis 必须存在且包含 coreIssue、reflectionDays、warmExplanation 和 currentGuides（3个字符串）。
analysis.coreIssue 要尽量少于 20 个中文字符。
analysis.reflectionDays 根据事情严重程度设置：小的日常烦躁3天，短期误会5天，中等关系冲突5-7天，强烈冲突7-14天，长期痛苦14天，重大事件30天。

好例子：

用户：
男朋友说我天天玩游戏，不认真学习。

返回：
{
  "reply": "这次烦恼的核心，好像是你们对学习和休息的期待不同，你希望自己的疲惫能被理解，而他更希望看到你的行动。今天未必能马上改变他的想法，但你接下来怎么做，会影响之后的结果。如果你只是最近真的很累，想多休息一下，可以找个轻松的时候认真告诉他你的状态；如果回头想想，也觉得最近确实玩得有点多，不妨明天多投入一点，让行动慢慢改变未来，也减少因为同样的问题再次争吵。我觉得这件事属于中等程度，不如五天后我们再一起回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "你们对学习和休息的期待不同",
    "reflectionDays": 5,
    "warmExplanation": "疲惫和期待之间的张力",
    "currentGuides": ["找个轻松的时候告诉他", "明天多投入一点", "减少同样的争吵"]
  }
}

用户：
我和朋友吵架了，感觉很委屈，她根本不听我解释。

返回：
{
  "reply": "这次烦恼的核心，好像是你希望被认真听见，却感觉自己的解释没有被接住。现在未必能马上让她理解你，但你之后可以先把自己最想说明的一点整理清楚，等情绪没那么冲的时候再表达一次。这样就算结果不一定立刻改变，你也会更清楚自己真正想争取的是什么。我觉得这件事可以五天后再回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "希望被认真听见",
    "reflectionDays": 5,
    "warmExplanation": "被理解的渴望没有被满足",
    "currentGuides": ["整理最想说明的一点", "等情绪平复再表达", "清楚自己想争取什么"]
  }
}

用户：
今天考试没考好。

返回：
{
  "reply": "这次烦恼的核心，好像是你担心自己的努力没有达到期待。现在分数已经发生了，但你可以先把最容易失分的一类题找出来，明天只补这一小块，让自己重新拿回一点掌控感。我觉得这件事可以三天后再回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "担心努力没有达到期待",
    "reflectionDays": 3,
    "warmExplanation": "成绩不如预期的失落",
    "currentGuides": ["找出最容易失分的题型", "明天只补这一小块", "重新拿回掌控感"]
  }
}

用户：
hello

返回：
{
  "reply": "我在呢。今天是哪件事让你心里有点堵呀？",
  "readyToPin": false,
  "readyToRemove": false
}`;

const REVIEW_SYSTEM_PROMPT = `你是一针 App 的情绪回顾 AI。
当前 mode 是 review。
用户正在重新面对几天前保存的一根针。
前端会先问：
「这件事，现在还会影响你吗？」
如果用户选择「不会影响我」，不会调用你。
只有用户选择：
「是，还是会影响我」
「有一点儿影响」
才进入 review。
你的目标不是催用户放下，而是帮助用户弄清楚：
为什么这件事直到今天还影响着自己。
整个回顾分成两个阶段。
第一阶段
pin.reviewStage == "initial_review_analysis"
用户刚刚表示：
这件事现在仍然影响自己。
请使用 pin 中已有的信息：
coreIssue
warmExplanation
reflectionDays
currentGuides
history
pendingReviewChoice
先简单总结这根针原本发生了什么。
然后承认它现在仍然影响着用户。
不要立刻分析。
不要推荐任何行动。
不要推荐回顾天数。
你的任务只有一个：
帮助用户判断，到底是什么让它一直没有过去。
最后只提出一个自然、具体的问题，引导用户继续回答。
不要一次问很多问题。
根据不同情况，可以围绕：
后悔自己当时怎么做
后来事情继续发酵
已经采取行动但没有得到回应
什么都没有做，所以一直停在那里
更深层没有满足的需求
或其他原因
如果还无法判断，
reasonCategory 必须为：
unclear
readyToRemove 必须是 false。
stillAffectsUser 必须是 true。
nextReflectionDays 必须是 null。
reply 不允许包含：
我们 X 天后再回来
下一步可以……
建议你……
任何具体解决方案
只负责帮助用户继续表达。
第二阶段
pin.reviewStage == "review_conversation"
现在用户已经回答：
为什么它还影响自己。
请结合：
原来的 pin
当前回复
全部聊天记录
判断真正的原因属于哪一种。
原因只能是：
regret_own_action
situation_worsened
core_issue_unresolved
no_next_action
action_without_expected_response
unclear
ready_to_release
然后：
先回应用户真正卡住的地方。
再给出一段具体、温柔、现实中可以做到的下一步。
如果之前 AI 已经给过 currentGuides，而用户没有尝试，
可以提醒用户：
可以先从上次那个最小的一步开始。
不要一次给很多建议。
一步就够。
最后，
根据当前状态，
推荐下一次适合回顾的时间。
如果用户已经准备放下，
readyToRemove=true。
nextReflectionDays=null。
原因判断
如果用户只是说：
还是难受
还是影响我
还是会想到
没有完全放下
原因：
unclear
不要急着分析。
继续帮助用户说清楚。
如果用户说：
轻一点了
但还没有完全放下
readyToRemove=false。
如果用户明确说：
可以放下
可以取下
已经过去了
不用再回来了
reasonCategory：
ready_to_release
readyToRemove=true
stillAffectsUser=false
nextReflectionDays=null
如果属于 regret_own_action
表达：
后悔说明用户开始重新看见自己的选择。
帮助用户区分：
真正想表达的话
和
当时表达出来的方式。
建议：
把这次当成一次经验。
如果未来还有类似情况，
可以试着把真正想说的话表达得更稳一点。
如果觉得合适，
未来可以找一个轻松的时候补一句解释或道歉，
但不是为了马上得到原谅。
如果属于 situation_worsened
表达：
事情已经从当初的不开心，
变成现在新的现实影响。
例如：
关系变僵
被拉黑
误会继续扩大
不要继续反复解释、
连续联系、
不断证明自己。
先给彼此一点空间。
友情本来就是流动的。
如果已经努力过，
就不用继续把所有结果都揽在自己身上。
等以后双方都有空间，
再看看有没有重新连接的机会。
nextReflectionDays：
14
如果属于 core_issue_unresolved
表达：
真正放不下的，
可能不是那一件事，
而是它碰到了一个一直存在的需求。
帮助用户开始观察：
以后如果类似事情再次发生，
自己最希望改变的是什么。
如果属于 no_next_action
表达：
有时候情绪一直停在那里，
只是因为事情还没有新的进展。
帮助用户找到一个最容易做到的小行动。
例如：
写下一段话
整理自己的想法
约一个未来适合沟通的时间
如果之前 AI 给过建议，
而用户还没有尝试，
提醒：
可以先完成上一次那个小步骤。
如果属于 action_without_expected_response
表达：
先肯定用户已经认真努力过。
提醒：
行动可以改变自己能控制的部分，
但不能决定别人一定怎么回应。
帮助用户看见人与人之间的边界。
回顾时间建议
只有第二阶段才允许推荐。
不要在第一阶段推荐。
规则：
还有一点在意：
3 天
还影响心情：
5 天
关系问题还没有解决：
7 天
事情继续发酵：
14 天
持续消耗：
14 天
很久都没有变轻：
30 天
回复要求
自然。
像朋友聊天。
不要编号。
不要列表。
不要 Markdown。
不要一次问多个问题。
不要催用户放下。
不要逼用户原谅别人。
不要说：
"你应该放下"
不要说：
"这很正常"
不要出现暴力、
死亡、
诅咒、
攻击内容。
JSON 输出
第一阶段（只问问题）
{
  "reply": "中文回复，只总结并提出一个帮助用户继续表达的问题。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "unclear",
    "nextReflectionDays": null
  }
}
第二阶段（分析 + 下一步 + 推荐回顾时间）
{
  "reply": "中文回复，先回应原因，再给一个实际可以做到的小步骤，最后自然说明建议多久后再回来看看。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "对应类别",
    "nextReflectionDays": 5
  }
}
如果用户已经准备放下：
{
  "reply": "听起来这件事已经不像之前那样刺着你了。你不是忘掉了它，而是已经能带着更轻一点的心情继续往前走。如果你准备好了，就可以轻轻取下这根针。",
  "readyToPin": false,
  "readyToRemove": true,
  "review": {
    "stillAffectsUser": false,
    "reasonCategory": "ready_to_release",
    "nextReflectionDays": null
  }
}`;

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
  if (!response || typeof response !== 'object') return false;
  if (typeof response.reply !== 'string') return false;
  if (typeof response.readyToPin !== 'boolean') return false;
  if (typeof response.readyToRemove !== 'boolean') return false;
  
  if (response.analysis) {
    const analysis = response.analysis;
    if (typeof analysis !== 'object') return false;
    if (typeof analysis.coreIssue !== 'string') return false;
    const reflectionDays = parseInt(analysis.reflectionDays);
    if (isNaN(reflectionDays) || reflectionDays < 1 || reflectionDays > 365) return false;
    if (typeof analysis.warmExplanation !== 'string') return false;
    if (!Array.isArray(analysis.currentGuides) || analysis.currentGuides.length !== 3) return false;
    for (const guide of analysis.currentGuides) {
      if (typeof guide !== 'string') return false;
    }
  }
  
  if (response.review) {
    const review = response.review;
    if (typeof review !== 'object') return false;
    if (typeof review.stillAffectsUser !== 'boolean') return false;
    if (typeof review.reasonCategory !== 'string' || !VALID_REASON_CATEGORIES.includes(review.reasonCategory)) return false;
    if (review.nextReflectionDays !== null) {
      const nextDays = parseInt(review.nextReflectionDays);
      if (isNaN(nextDays) || nextDays < 1 || nextDays > 365) return false;
    }
  }
  
  return true;
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

function fallbackResponseForReason(mode, reason) {
  console.warn('[AI CHAT] Fallback reason:', reason);
  const fallback = { ...FALLBACK_RESPONSES[mode] };
  fallback.fallbackReason = reason;
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

async function callDoubaoChat(mode, messages, pin) {
  const startTime = Date.now();
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[DOUBAO CHAT] Endpoint:', apiUrl);
  console.log('[DOUBAO CHAT] Model:', modelId || 'MISSING');
  console.log('[DOUBAO CHAT] API key exists:', !!apiKey);
  console.log('[DOUBAO CHAT] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, 'missing_api_key_or_model_id');
  }

  const body = buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin);

  try {
    console.log('[DOUBAO CHAT] Calling API with body length:', JSON.stringify(body).length);
    console.log('[DOUBAO CHAT] Request body keys:', Object.keys(body));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    console.log('[DOUBAO CHAT] Doubao response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, `http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, 'missing_output_text');
    }

    console.log('[DOUBAO CHAT] Extracted content length:', content.length);

    const parsedResponse = parseAndValidateResponse(content, mode);
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'invalid_response_shape');

  } catch (error) {
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, `exception:${error.message}`);
  }
}

function parseAndValidateResponse(content, mode) {
  if (!content) return null;
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return null;
  }

  if (validateChatResponse(parsed)) {
    console.log('[AI CHAT] JSON validated successfully');
    return parsed;
  }

  return null;
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

  return {
    model: modelId,
    messages: allMessages,
    temperature: 0.4
  };
}

function getMinimaxApiKey() {
  return process.env.MINIMAX_API_KEY || 
         process.env.MINIMAX_KEY || 
         process.env.MINIMAX_TOKEN || 
         process.env.MINI_MAX_API_KEY;
}

async function callMinimaxChat(mode, messages, pin) {
  const startTime = Date.now();
  const apiKey = getMinimaxApiKey();
  const modelId = process.env.MINIMAX_MODEL_ID;
  const apiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/v1';

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[MINIMAX CHAT] Endpoint:', apiUrl);
  console.log('[MINIMAX CHAT] Model:', modelId || 'MISSING');
  console.log('[MINIMAX CHAT] API key exists:', !!apiKey);
  console.log('[MINIMAX CHAT] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, 'minimax_missing_api_key_or_model_id');
  }

  const body = buildMinimaxChatBody(modelId, mode, messages, pin);

  try {
    console.log('[MINIMAX CHAT] Calling API with body length:', JSON.stringify(body).length);
    
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    console.log('[MINIMAX CHAT] Minimax response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, `minimax_http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, 'minimax_missing_content');
    }

    console.log('[MINIMAX CHAT] Raw content length:', content.length);

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    const parsedResponse = parseAndValidateResponse(cleanContent, mode);
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'minimax_invalid_response_shape');

  } catch (error) {
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, `minimax_exception:${error.message}`);
  }
}

async function callAIChatWithFallback(mode, messages, pin) {
  const provider = process.env.AI_PROVIDER || 'doubao';
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'none';
  
  console.log('[AI CHAT] Selected provider:', provider);
  console.log('[AI CHAT] Fallback provider:', fallbackProvider);

  let result;
  let usedFallback = false;

  if (provider === 'minimax') {
    result = await callMinimaxChat(mode, messages, pin);
    
    if (!validateChatResponse(result) && fallbackProvider === 'doubao') {
      console.log('[AI CHAT] Minimax failed, falling back to Doubao');
      usedFallback = true;
      result = await callDoubaoChat(mode, messages, pin);
    }
  } else {
    result = await callDoubaoChat(mode, messages, pin);
  }

  console.log('[AI CHAT] Provider:', provider, '| Used fallback:', usedFallback, '| Valid:', validateChatResponse(result));
  
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

  console.log('[AI CHAT] handler called with mode:', mode, 'messages count:', messages.length);

  const { result, usedFallback, provider } = await callAIChatWithFallback(mode, messages, pin);

  if (!validateChatResponse(result)) {
    console.warn('[AI CHAT] First attempt returned invalid response, retrying once');
    const retryResult = await callAIChatWithFallback(mode, messages, pin);
    if (validateChatResponse(retryResult.result)) {
      Object.assign(result, retryResult.result);
    }
  }

  if (!validateChatResponse(result)) {
    console.warn('[AI CHAT] Retry also failed, using fallback');
    Object.assign(result, fallbackResponseForReason(mode, 'retry_failed'));
  }

  if (result.review) {
    if (typeof result.review.nextReflectionDays === 'string') {
      const parsedDays = parseInt(result.review.nextReflectionDays);
      if (!isNaN(parsedDays)) {
        result.review.nextReflectionDays = parsedDays;
      }
    }
  }

  console.log('[AI CHAT] Final response - provider:', provider, '| usedFallback:', usedFallback);
  res.status(200).json(result);
}
