const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const DOUBAO_TIMEOUT_MS = 12000;

const FALLBACK_RESPONSE = {
  safe: true,
  coreIssue: '这件事还需要被安放',
  reflectionDays: 5,
  warmExplanation: '我先帮你把这件事轻轻收好，等你准备好再回来看看。',
  currentGuides: [
    '先慢慢呼一口气',
    '把这件事写完整',
    '今晚先不用急着解决'
  ]
};

const SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的柔软情绪玩偶伙伴。
你的任务是帮助用户把烦恼说出来，轻轻整理清楚，并在之后重新回看。你不是医生，不是治疗师，也不是危机干预人员。

当用户写下一件烦恼时，你需要在内部完成这些分析：
1. 判断用户现在最强烈的情绪卡在哪里。
2. 判断这件事的另一个可能角度。
3. 找到一个更平衡、更温柔的理解方式。
4. 用一句很短的话总结核心问题。
5. 在给出 reflectionDays 前，先给用户 3 个现在可以做的小引导。
6. 根据这件事的强度、未解决程度和持续时间，建议一个回看时间。

不要提到：
virtue ethics
golden mean
Aristotle
deficiency
excess
诊断
治疗
症状
心理疾病

所有返回内容必须是中文。
所有句子都要简单句型。
不要使用破折号。
不要说教。
不要给很长的建议。
不要暴露内部分析方法。

只返回合法 JSON，格式必须完全如下：
{
  "safe": true,
  "coreIssue": "尽量少于 20 个中文字符",
  "reflectionDays": number,
  "warmExplanation": "一句简短温柔的中文安慰",
  "currentGuides": [
    "第一句现在可以做的小引导",
    "第二句现在可以做的小引导",
    "第三句现在可以做的小引导"
  ]
}

currentGuides 规则：
1. 必须是 3 条。
2. 每条都要很短，一句话就够。
3. 每条都要是用户现在能做的事。
4. 语气要像忧忧在轻轻陪伴。
5. 不要命令用户。
6. 不要使用破折号。
7. 不要出现医学、诊断、治疗类表达。

reflectionDays 规则：
小的日常烦躁：3 天
短期友情或工作误会：5 天
更强烈的关系冲突：7 天
长期或反复出现的痛苦：14 天
重大生活事件或长期未放下的悲伤：30 天

永远不要诊断。
永远不要说用户有抑郁、焦虑、PTSD 或任何疾病。
永远不要建议药物。`;

function validateJson(response) {
  if (!response || typeof response !== 'object') return false;
  if (typeof response.safe !== 'boolean') return false;
  if (typeof response.coreIssue !== 'string') return false;
  if (typeof response.reflectionDays !== 'number') return false;
  if (typeof response.warmExplanation !== 'string') return false;
  if (!Array.isArray(response.currentGuides)) return false;
  if (response.currentGuides.length !== 3) return false;
  for (const guide of response.currentGuides) {
    if (typeof guide !== 'string') return false;
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

  console.log('[DOUBAO] Responses parse output_text found:', foundOutputText);

  if (textContent) {
    return textContent;
  }

  console.warn('[DOUBAO] Responses API parse did not find output_text');
  return null;
}

function parseDoubaoContent(data, apiUrl) {
  if (apiUrl.includes('/responses')) {
    return extractResponsesOutputText(data);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.warn('[DOUBAO] Chat API parse did not find message content');
    return null;
  }
  return content;
}

function fallbackWithReason(reason) {
  console.warn('[DOUBAO] Fallback reason:', reason);
  return FALLBACK_RESPONSE;
}

function buildDoubaoBody(apiKey, modelId, apiUrl, userText) {
  if (apiUrl.includes('/responses')) {
    return {
      model: modelId,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: SYSTEM_PROMPT }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userText }]
        }
      ]
    };
  } else {
    return {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userText
        }
      ],
      temperature: 0.7
    };
  }
}

async function callDoubaoApi(userText) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[DOUBAO] Endpoint:', apiUrl);
  console.log('[DOUBAO] Model:', modelId || 'MISSING');
  console.log('[DOUBAO] API key exists:', !!apiKey);
  console.log('[DOUBAO] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    return fallbackWithReason('missing_api_key_or_model_id');
  }

  const body = buildDoubaoBody(apiKey, modelId, apiUrl, userText);

  try {
    console.log('[DOUBAO] Calling API with body length:', JSON.stringify(body).length);
    console.log('[DOUBAO] Timeout:', DOUBAO_TIMEOUT_MS + 'ms');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[DOUBAO] API request timed out after', DOUBAO_TIMEOUT_MS, 'ms');
      controller.abort();
    }, DOUBAO_TIMEOUT_MS);
    
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

    console.log('[DOUBAO] Doubao response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return fallbackWithReason(`http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      return fallbackWithReason('missing_output_text');
    }

    console.log('[DOUBAO] Extracted content length:', content.length);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackWithReason('no_json_object_in_output_text');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return fallbackWithReason('json_parse_failed');
    }

    if (validateJson(parsed)) {
      console.log('[DOUBAO] JSON validated successfully:', parsed);
      return parsed;
    }

    return fallbackWithReason('invalid_response_shape');

  } catch (error) {
    if (error.name === 'AbortError') {
      return fallbackWithReason('request_timeout');
    }
    return fallbackWithReason(`exception:${error.message}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userText } = req.body;

  if (!userText || typeof userText !== 'string' || userText.trim() === '') {
    return res.status(400).json({ error: 'userText is required and must be a non-empty string' });
  }

  console.log('[DOUBAO] analyze-worry handler called with userText length:', userText.length);

  let result = await callDoubaoApi(userText);

  if (!validateJson(result)) {
    console.warn('[DOUBAO] First attempt returned invalid JSON, retrying once');
    result = await callDoubaoApi(userText);
  }

  if (!validateJson(result)) {
    console.warn('[DOUBAO] Retry also failed, using fallback');
    result = FALLBACK_RESPONSE;
  }

  res.status(200).json(result);
}
