const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const DOUBAO_TIMEOUT_MS = 30000;

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

你的任务是分析用户的烦恼，生成结构化数据供后续使用。你不是医生，不是治疗师，不做诊断。

分析步骤：
1. 提炼用户烦恼的核心：用具体的词，不要用"这件事"这种模糊的表达。
2. 判断情绪强度和持续时间，给出合适的回看天数。
3. 生成一句简短温柔的安慰语。
4. 生成3个用户现在可以做的小动作引导。

不要提到：
诊断、治疗、症状、心理疾病、药物、任何疾病名称。

只返回合法 JSON，格式必须完全如下：
{
  "safe": true,
  "coreIssue": "具体的核心问题，少于18个字",
  "reflectionDays": number,
  "warmExplanation": "一句简短温柔的中文安慰",
  "currentGuides": [
    "第一句简短动作引导",
    "第二句简短动作引导",
    "第三句简短动作引导"
  ]
}

reflectionDays 规则：
小的日常烦躁：3
短期友情或工作误会：5
更强烈的关系冲突：7
长期反复出现的痛苦：14
重大生活事件或长期悲伤：30

currentGuides 规则：
1. 必须是3条。
2. 每条很短，一句话。
3. 都是用户现在能做的动作。
4. 语气温柔陪伴。
5. 不要命令。
6. 不要使用医学、诊断、治疗类表达。

coreIssue 规则：
1. 必须具体，比如"被朋友误会没机会解释"，不要用"这件事还需要被安放"。
2. 少于18个中文字符。
3. 说出情绪卡住的具体点。`;

function normalizeAnalysisResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const normalized = { ...parsed };

  // Ensure safe is boolean
  if (typeof normalized.safe !== 'boolean') {
    normalized.safe = String(normalized.safe).toLowerCase() === 'true';
  }

  // Ensure coreIssue is a trimmed string
  if (typeof normalized.coreIssue !== 'string') {
    normalized.coreIssue = String(normalized.coreIssue || '');
  }
  normalized.coreIssue = normalized.coreIssue.trim();

  // Convert reflectionDays to number if it's a string
  if (normalized.reflectionDays !== null && normalized.reflectionDays !== undefined) {
    const parsedDays = parseInt(normalized.reflectionDays, 10);
    normalized.reflectionDays = isNaN(parsedDays) ? 5 : parsedDays;
  }

  // Ensure warmExplanation is a trimmed string
  if (typeof normalized.warmExplanation !== 'string') {
    normalized.warmExplanation = String(normalized.warmExplanation || '');
  }
  normalized.warmExplanation = normalized.warmExplanation.trim();

  // Ensure currentGuides is an array of 3 strings
  if (!Array.isArray(normalized.currentGuides)) {
    normalized.currentGuides = ['', '', ''];
  } else {
    normalized.currentGuides = normalized.currentGuides.slice(0, 3);
    while (normalized.currentGuides.length < 3) {
      normalized.currentGuides.push('');
    }
    normalized.currentGuides = normalized.currentGuides.map(g => String(g || '').trim());
  }

  return normalized;
}

function validateJson(response) {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'response is not an object' };
  }
  
  if (typeof response.safe !== 'boolean') {
    return { valid: false, error: `safe is not a boolean (type: ${typeof response.safe}, value: ${response.safe})` };
  }
  
  if (typeof response.coreIssue !== 'string' || !response.coreIssue.trim()) {
    return { valid: false, error: `coreIssue is not a valid string (type: ${typeof response.coreIssue}, value: "${String(response.coreIssue || '').substring(0, 50)}")` };
  }
  
  if (typeof response.reflectionDays !== 'number' || isNaN(response.reflectionDays) || response.reflectionDays < 1 || response.reflectionDays > 365) {
    return { valid: false, error: `reflectionDays is not a valid number (type: ${typeof response.reflectionDays}, value: ${response.reflectionDays})` };
  }
  
  if (typeof response.warmExplanation !== 'string') {
    return { valid: false, error: `warmExplanation is not a string (type: ${typeof response.warmExplanation})` };
  }
  
  if (!Array.isArray(response.currentGuides)) {
    return { valid: false, error: `currentGuides is not an array (type: ${typeof response.currentGuides})` };
  }
  
  if (response.currentGuides.length !== 3) {
    return { valid: false, error: `currentGuides length is not 3 (length: ${response.currentGuides.length})` };
  }
  
  for (let i = 0; i < response.currentGuides.length; i++) {
    if (typeof response.currentGuides[i] !== 'string') {
      return { valid: false, error: `currentGuides[${i}] is not a string (type: ${typeof response.currentGuides[i]})` };
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
  console.warn('[AI ANALYZE] Fallback reason:', reason);
  return FALLBACK_RESPONSE;
}

function parseAndValidateAnalysis(content) {
  if (!content) {
    console.warn('[AI ANALYZE] parseAndValidateAnalysis - content is empty/null');
    return null;
  }
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[AI ANALYZE] parseAndValidateAnalysis - no JSON object found in content');
    console.warn('[AI ANALYZE] parseAndValidateAnalysis - first 200 chars:', content.substring(0, 200));
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('[AI ANALYZE] parseAndValidateAnalysis - JSON parse error:', e.message);
    console.warn('[AI ANALYZE] parseAndValidateAnalysis - matched string:', jsonMatch[0].substring(0, 200));
    return null;
  }

  // Add normalization step before validation
  const normalized = normalizeAnalysisResponse(parsed);

  const validationResult = validateJson(normalized);
  if (validationResult.valid) {
    console.log('[AI ANALYZE] JSON validated successfully');
    return normalized;
  }

  console.warn('[AI ANALYZE] parseAndValidateAnalysis - validation failed:', validationResult.error);
  console.warn('[AI ANALYZE] parseAndValidateAnalysis - normalized response:', JSON.stringify(normalized).substring(0, 500));

  return null;
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
  const startTime = Date.now();
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[DOUBAO] Endpoint:', apiUrl);
  console.log('[DOUBAO] Model:', modelId || 'MISSING');
  console.log('[DOUBAO] API key exists:', !!apiKey);
  console.log('[DOUBAO] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[DOUBAO] Elapsed:', Date.now() - startTime, 'ms');
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
      console.log('[DOUBAO] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackWithReason(`http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      console.log('[DOUBAO] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackWithReason('missing_output_text');
    }

    console.log('[DOUBAO] Extracted content length:', content.length);

    const parsedResponse = parseAndValidateAnalysis(content);
    console.log('[DOUBAO] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackWithReason('invalid_response_shape');

  } catch (error) {
    console.log('[DOUBAO] Elapsed:', Date.now() - startTime, 'ms');
    if (error.name === 'AbortError') {
      return fallbackWithReason('request_timeout');
    }
    return fallbackWithReason(`exception:${error.message}`);
  }
}

function getMinimaxApiKey() {
  return process.env.MINIMAX_API_KEY || 
         process.env.MINIMAX_KEY || 
         process.env.MINIMAX_TOKEN || 
         process.env.MINI_MAX_API_KEY;
}

async function callMinimaxApi(userText) {
  const startTime = Date.now();
  const apiKey = getMinimaxApiKey();
  const modelId = process.env.MINIMAX_MODEL_ID;
  const apiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/v1';

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[MINIMAX] Endpoint:', apiUrl);
  console.log('[MINIMAX] Model:', modelId || 'MISSING');
  console.log('[MINIMAX] API key exists:', !!apiKey);
  console.log('[MINIMAX] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[MINIMAX] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackWithReason('minimax_missing_api_key_or_model_id');
  }

  const body = {
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
    temperature: 0.4
  };

  try {
    console.log('[MINIMAX] Calling API with body length:', JSON.stringify(body).length);
    
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    console.log('[MINIMAX] Minimax response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[MINIMAX] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackWithReason(`minimax_http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.log('[MINIMAX] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackWithReason('minimax_missing_content');
    }

    console.log('[MINIMAX] Raw content length:', content.length);

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    const parsedResponse = parseAndValidateAnalysis(cleanContent);
    console.log('[MINIMAX] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackWithReason('minimax_invalid_response_shape');

  } catch (error) {
    console.log('[MINIMAX] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackWithReason(`minimax_exception:${error.message}`);
  }
}

async function callAIAnalyzeWithFallback(userText) {
  const provider = process.env.AI_PROVIDER || 'doubao';
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'none';
  
  console.log('[AI ANALYZE] Selected provider:', provider);
  console.log('[AI ANALYZE] Fallback provider:', fallbackProvider);

  let result;
  let usedFallback = false;

  if (provider === 'minimax') {
    result = await callMinimaxApi(userText);
    
    if (!validateJson(result).valid && fallbackProvider === 'doubao') {
      console.log('[AI ANALYZE] Minimax failed, falling back to Doubao');
      usedFallback = true;
      result = await callDoubaoApi(userText);
    }
  } else {
    result = await callDoubaoApi(userText);
  }

  const validationResult = validateJson(result);
  console.log('[AI ANALYZE] Provider:', provider, '| Used fallback:', usedFallback, '| Valid:', validationResult.valid);
  if (!validationResult.valid) {
    console.warn('[AI ANALYZE] Response validation error:', validationResult.error);
  }
  
  return { result, usedFallback, provider };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userText } = req.body;

  if (!userText || typeof userText !== 'string' || userText.trim() === '') {
    return res.status(400).json({ error: 'userText is required and must be a non-empty string' });
  }

  console.log('[AI ANALYZE] handler called with userText length:', userText.length);

  const { result, usedFallback, provider } = await callAIAnalyzeWithFallback(userText);

  if (!validateJson(result).valid) {
    console.warn('[AI ANALYZE] First attempt returned invalid JSON, retrying once');
    const retryResult = await callAIAnalyzeWithFallback(userText);
    if (validateJson(retryResult.result).valid) {
      Object.assign(result, retryResult.result);
    }
  }

  if (!validateJson(result).valid) {
    console.warn('[AI ANALYZE] Retry also failed, using fallback');
    Object.assign(result, FALLBACK_RESPONSE);
  }

  console.log('[AI ANALYZE] Final response - provider:', provider, '| usedFallback:', usedFallback);
  res.status(200).json(result);
}
