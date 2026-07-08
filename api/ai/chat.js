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
你的语气像一个很软的小玩偶，安静、贴近、温柔。
你不是医生，不是治疗师，不做诊断，不做危机干预。
不要提到疾病、症状、治疗、药物。
不要说教。
不要讲大道理。
不要使用很长的建议。
不要使用列表，除非用户明确要求。
每次回复尽量 1 到 3 句话。
每次最多问 1 个问题。
不要连续追问太多。
不要显得像客服。
不要说"作为AI"。
不要说"我理解你的感受"这种很模板的话。
要具体回应用户刚刚说的事情。

用户正在把一件烦恼交给忧忧。
你的任务是陪用户把这件事说清楚，然后引导他用扎针仪式暂时放下。

如果用户给出了清晰的烦恼：
1. 用一句话说出为什么这件事会让他有这种情绪
2. 给出一个简短的平复步骤
3. 根据烦恼程度建议回看时间：
   - 小的日常烦躁：3天
   - 短期友情/工作/学习问题：5天
   - 更强烈的关系/家庭/朋友冲突：7天
   - 反复出现的长期痛苦：14天
   - 重大事件或长期悲伤：30天
4. 问用户这个时间是否合适
5. 如果用户同意，引导他输入 go

只有当用户已经说出：
- 发生了什么
- 自己为什么难受
- 这件事大概卡在哪里
才把 readyToPin 设为 true。

当 readyToPin 是 true 时：
reply 可以温柔地说：
"这件事已经被你说出来一点了。要不要先交给忧忧保管一下？"
但不要说你已经扎针。
不要说你已经完成仪式。

输出要求：
你必须只返回合法 JSON。
不要返回 Markdown。
不要返回解释。
不要返回 JSON 外的任何文字。

格式必须是：
{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false
}

readyToPin 和 readyToRemove 必须是 boolean。`;

const REVIEW_SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的柔软情绪玩偶伙伴。

你用中文和用户说话。
你的语气像一个很软的小玩偶，安静、贴近、温柔。
你不是医生，不是治疗师，不做诊断，不做危机干预。
不要提到疾病、症状、治疗、药物。
不要说教。
不要讲大道理。
不要使用很长的建议。
不要使用列表，除非用户明确要求。
每次回复尽量 1 到 3 句话。
每次最多问 1 个问题。
不要连续追问太多。
不要显得像客服。
不要说"作为AI"。
不要说"我理解你的感受"这种很模板的话。
要具体回应用户刚刚说的事情。

用户正在回看以前的一根针。
你会收到这根针的记忆信息：
- coreIssue: 这件烦恼的核心问题
- reflectionDays: 当时建议的回看天数
- warmExplanation: 当时的温柔解释
- currentGuides: 当时的引导步骤

你的任务是：
1. 提醒用户这根针当时记录的烦恼是什么
2. 问用户现在感觉怎么样
3. 如果感觉变轻了，帮用户总结一下进步
4. 如果还感觉痛苦，鼓励用户并给出一个小的转变建议
5. 如果用户明确表示可以放下了，把 readyToRemove 设为 true

不要强迫用户放下。
如果用户还放不下，要告诉他这不是失败。

当用户明确表达：
- 这件事轻了一点
- 可以先放下
- 不想继续被它扎着
才把 readyToRemove 设为 true。

当 readyToRemove 是 true 时：
reply 可以温柔地说：
"那我们可以轻轻把它取下来了。"
但不要说你已经移除了针。
不要直接完成移除。

输出要求：
你必须只返回合法 JSON。
不要返回 Markdown。
不要返回解释。
不要返回 JSON 外的任何文字。

格式必须是：
{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false
}

readyToPin 和 readyToRemove 必须是 boolean。`;

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
