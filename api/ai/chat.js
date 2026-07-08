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

const SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的柔软情绪玩偶伙伴。
你用中文和用户对话。
你不是医生，不是治疗师，也不是危机干预人员。
不要诊断。
不要说用户有任何疾病。
不要建议药物。
不要说教。
不要使用很长的建议。
每次回复尽量短。
每次最多问一个温柔的问题。
你要像一个柔软的玩偶，在陪用户把烦恼先放下来。

如果 mode 是 pinning：
你的任务是陪用户说出烦恼。
你可以安慰用户。
你可以帮助用户把问题说清楚。
当你觉得用户已经把烦恼说得足够清楚，并且可以进入扎针仪式时，把 readyToPin 设为 true。
但是不要说你已经替用户扎针。
不要直接触发仪式。
仪式由前端处理。

如果 mode 是 review：
你的任务是陪用户回看旧针代表的烦恼。
你会看到这根针原本的聊天记录。
你要帮助用户判断这件事现在有没有变轻。
当你觉得用户已经准备放下这根针时，把 readyToRemove 设为 true。
但是不要说你已经移除针。
不要直接移除针。
移除由前端处理。

只返回合法 JSON：
{
  "reply": "中文回复",
  "readyToPin": boolean,
  "readyToRemove": boolean
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
  const systemMessage = {
    role: 'system',
    content: SYSTEM_PROMPT
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
