const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';

const FALLBACK_RESPONSES = {
  pinning: {
    reply: '我在听，你可以慢慢说。准备好了，就告诉我。',
    readyToPin: false,
    readyToRemove: false
  },
  review: {
    reply: '我还在这里陪你。你可以慢慢看看，这件事现在有没有轻一点。',
    readyToPin: false,
    readyToRemove: false
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
不要说“作为AI”。
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
“我觉得这件事属于中等程度，不如五天后我们再一起回来看看。”
语气要自然，不要像系统通知。

第四部分：
询问用户是否接受这个时间。
如果可以，就让用户输入 go，把这件事先交给忧忧保管。

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
“男朋友说我天天玩游戏，不认真学习。”

不要写：
“你因为男朋友说你不上进而难过。”

更好写：
“这次烦恼的核心，好像是你们对学习和休息的期待不同，你希望自己的疲惫能被理解，而他更希望看到你的行动。”

用户说：
“朋友一直不回我消息。”

不要写：
“你因为朋友不回消息很难过。”

更好写：
“这次让你在意的，好像是不确定这段关系是不是还和以前一样。”

用户说：
“今天考试没考好。”

不要写：
“你考试没考好。”

更好写：
“这次烦恼的核心，好像是你担心自己的努力没有达到期待。”

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

当你已经给出核心原因、行动建议、回看时间和 go 指令时：
readyToPin 必须是 true。
不要说针已经扎好了。
不要说仪式已经完成。
前端会在用户输入 go 后处理扎针仪式。

输出要求：

你必须只返回合法 JSON。
不要返回 JSON 外的任何文字。
不要返回 Markdown。
不要解释你的思考过程。

格式必须完全如下：

{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false
}

readyToPin 和 readyToRemove 必须是 boolean。

好例子：

用户：
男朋友说我天天玩游戏，不认真学习。

返回：
{
  "reply": "这次烦恼的核心，好像是你们对学习和休息的期待不同，你希望自己的疲惫能被理解，而他更希望看到你的行动。今天未必能马上改变他的想法，但你接下来怎么做，会影响之后的结果。如果你只是最近真的很累，想多休息一下，可以找个轻松的时候认真告诉他你的状态；如果回头想想，也觉得最近确实玩得有点多，不妨明天多投入一点，让行动慢慢改变未来，也减少因为同样的问题再次争吵。我觉得这件事属于中等程度，不如五天后我们再一起回来看看。如果你觉得这个时间可以，就输入 go，把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false
}

用户：
我和朋友吵架了，感觉很委屈，她根本不听我解释。

返回：
{
  "reply": "这次烦恼的核心，好像是你希望被认真听见，却感觉自己的解释没有被接住。现在未必能马上让她理解你，但你之后可以先把自己最想说明的一点整理清楚，等情绪没那么冲的时候再表达一次。这样就算结果不一定立刻改变，你也会更清楚自己真正想争取的是什么。我觉得这件事可以五天后再回来看看。如果你觉得这个时间可以，就输入 go，把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false
}

用户：
今天考试没考好。

返回：
{
  "reply": "这次烦恼的核心，好像是你担心自己的努力没有达到期待。现在分数已经发生了，但你可以先把最容易失分的一类题找出来，明天只补这一小块，让自己重新拿回一点掌控感。我觉得这件事可以三天后再回来看看。如果你觉得这个时间可以，就输入 go，把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false
}

用户：
hello

返回：
{
  "reply": "我在呢。今天是哪件事让你心里有点堵呀？",
  "readyToPin": false,
  "readyToRemove": false
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

function validateChatResponse(response) {
  if (!response || typeof response !== 'object') return false;
  if (typeof response.reply !== 'string') return false;
  if (typeof response.readyToPin !== 'boolean') return false;
  if (typeof response.readyToRemove !== 'boolean') return false;
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
  console.warn('[DOUBAO CHAT] Fallback reason:', reason);
  return FALLBACK_RESPONSES[mode];
}

function buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}`
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
      messages: allMessages,
      temperature: 0.7
    };
  }
}

async function callDoubaoChat(mode, messages, pin) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[DOUBAO CHAT] Endpoint:', apiUrl);
  console.log('[DOUBAO CHAT] Model:', modelId || 'MISSING');
  console.log('[DOUBAO CHAT] API key exists:', !!apiKey);
  console.log('[DOUBAO CHAT] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    return fallbackResponseForReason(mode, 'missing_api_key_or_model_id');
  }

  const body = buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin);

  try {
    console.log('[DOUBAO CHAT] Calling API with body length:', JSON.stringify(body).length);
    
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
      return fallbackResponseForReason(mode, `http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      return fallbackResponseForReason(mode, 'missing_output_text');
    }

    console.log('[DOUBAO CHAT] Extracted content length:', content.length);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackResponseForReason(mode, 'no_json_object_in_output_text');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return fallbackResponseForReason(mode, 'json_parse_failed');
    }

    if (validateChatResponse(parsed)) {
      console.log('[DOUBAO CHAT] JSON validated successfully:', parsed);
      return parsed;
    }

    return fallbackResponseForReason(mode, 'invalid_response_shape');

  } catch (error) {
    return fallbackResponseForReason(mode, `exception:${error.message}`);
  }
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

  console.log('[DOUBAO CHAT] handler called with mode:', mode, 'messages count:', messages.length);

  let result = await callDoubaoChat(mode, messages, pin);

  if (!validateChatResponse(result)) {
    console.warn('[DOUBAO CHAT] First attempt returned invalid response, retrying once');
    result = await callDoubaoChat(mode, messages, pin);
  }

  if (!validateChatResponse(result)) {
    console.warn('[DOUBAO CHAT] Retry also failed, using fallback');
    result = FALLBACK_RESPONSES[mode];
  }

  res.status(200).json(result);
}
