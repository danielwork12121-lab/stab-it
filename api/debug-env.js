export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const doubaoApiKey = process.env.DOUBAO_API_KEY;
  const minimaxApiKey = process.env.MINIMAX_API_KEY;
  const minimaxKeyAlias = process.env.MINIMAX_KEY;
  const minimaxTokenAlias = process.env.MINIMAX_TOKEN;
  const miniMaxApiKeyAlias = process.env.MINI_MAX_API_KEY;
  
  const minimaxEnvKeys = Object.keys(process.env).filter(key => 
    key.toUpperCase().includes('MINIMAX') || key.toUpperCase().includes('MINI_MAX')
  );
  
  const miniEnvKeys = Object.keys(process.env).filter(key => 
    key.toUpperCase().includes('MINI') && !key.toUpperCase().includes('NODE')
  );

  res.status(200).json({
    aiProvider: process.env.AI_PROVIDER || 'doubao',
    aiFallbackProvider: process.env.AI_FALLBACK_PROVIDER || 'none',
    
    doubaoApiKeyExists: !!doubaoApiKey,
    doubaoApiKeyLength: doubaoApiKey ? doubaoApiKey.length : 0,
    doubaoApiKeyPrefix: doubaoApiKey ? (doubaoApiKey.startsWith('ark-') ? 'ark-...' : doubaoApiKey.substring(0, 6) + '...') : 'MISSING',
    doubaoModelId: process.env.DOUBAO_MODEL_ID || 'MISSING',
    doubaoApiUrl: process.env.DOUBAO_API_URL || 'MISSING',
    
    minimaxApiKeyExists: !!minimaxApiKey,
    minimaxApiKeyLength: minimaxApiKey ? minimaxApiKey.length : 0,
    minimaxApiKeyPrefix: minimaxApiKey ? minimaxApiKey.substring(0, 6) + '...' : 'MISSING',
    minimaxKeyAliasExists: !!minimaxKeyAlias,
    minimaxKeyAliasLength: minimaxKeyAlias ? minimaxKeyAlias.length : 0,
    minimaxTokenAliasExists: !!minimaxTokenAlias,
    minimaxTokenAliasLength: minimaxTokenAlias ? minimaxTokenAlias.length : 0,
    miniMaxApiKeyAliasExists: !!miniMaxApiKeyAlias,
    miniMaxApiKeyAliasLength: miniMaxApiKeyAlias ? miniMaxApiKeyAlias.length : 0,
    minimaxModelId: process.env.MINIMAX_MODEL_ID || 'MISSING',
    minimaxApiUrl: process.env.MINIMAX_API_URL || 'MISSING',
    
    minimaxEnvKeys,
    miniEnvKeys
  });
}
