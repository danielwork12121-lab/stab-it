export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DOUBAO_API_KEY;
  
  res.status(200).json({
    doubaoApiKeyExists: !!apiKey,
    doubaoApiKeyPrefix: apiKey ? (apiKey.startsWith('ark-') ? 'ark-...' : apiKey.substring(0, 8) + '...') : 'MISSING',
    doubaoModelId: process.env.DOUBAO_MODEL_ID || 'MISSING',
    doubaoApiUrl: process.env.DOUBAO_API_URL || 'MISSING'
  });
}
