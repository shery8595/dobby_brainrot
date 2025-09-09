// api/elevenlabs.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const API_KEY = process.env.ELEVENLABS_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const { text, voiceId, stability, similarityBoost } = req.body;
    
    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Text and voiceId are required' });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: stability || 0.5,
          similarity_boost: similarityBoost || 0.5,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error:', errorText);
      return res.status(response.status).json({ error: 'Text-to-speech API error' });
    }

    // Get the audio blob and convert to base64 for sending to client
    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    res.status(200).json({ 
      audio: base64,
      mimeType: audioBlob.type
    });
  } catch (error) {
    console.error('ElevenLabs proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
