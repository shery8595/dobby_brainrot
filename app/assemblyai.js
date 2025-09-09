// api/assemblyai.js
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
    const API_KEY = process.env.ASSEMBLYAI_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const { audio } = req.body;
    
    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': API_KEY,
      },
      body: audio
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('AssemblyAI upload error:', errorText);
      return res.status(uploadResponse.status).json({ error: 'Upload failed' });
    }

    const uploadData = await uploadResponse.json();
    
    // Request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: uploadData.upload_url,
        punctuate: true,
        format_text: true
      })
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('AssemblyAI transcript error:', errorText);
      return res.status(transcriptResponse.status).json({ error: 'Transcription failed' });
    }

    const transcriptData = await transcriptResponse.json();
    
    // Poll for results
    let pollingResponse;
    let pollingData;
    
    while (true) {
      pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptData.id}`, {
        headers: { 'authorization': API_KEY }
      });
      
      pollingData = await pollingResponse.json();
      
      if (pollingData.status === 'completed') break;
      if (pollingData.status === 'error') {
        return res.status(500).json({ error: 'Transcription failed' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.status(200).json(pollingData);
  } catch (error) {
    console.error('AssemblyAI proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
