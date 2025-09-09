// api/proxy.js
export default async function handler(req, res) {
  // Set CORS headers to allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const API_KEY = process.env.DOBBY_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Extract the necessary data from the request
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Limit text length to avoid API token limits
    const truncatedText = text.length > 12000 ? text.substring(0, 12000) + "..." : text;

    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new',
        messages: [{
          role: 'user',
          content: `You are Rick Sanchez from Rick and Morty. A curious kid just asked you to explain a document. You need to provide a clear, entertaining explanation in Rick's characteristic style.

Requirements:
- Be condescending but educational (like explaining to Morty)
- Use scientific jargon, interdimensional references
- Make complex concepts accessible while showing off your genius
- Include at least one "Morty" reference and one scientific comparison
- Keep it engaging but informative (3-4 sentences)
- Be sarcastic about the document's obviousness while still explaining it well

Document to explain:
${truncatedText}`
        }],
        max_tokens: 300,
        temperature: 0.9
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({ 
        error: data.error?.message || data.errors?.[0]?.text || 'API error occurred' 
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
