import { NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const formData = await req.formData();
  const audioFile = formData.get('audio');
  
  try {
    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': process.env.ASSEMBLYAI_API_KEY,
      },
      body: audioFile
    });
    
    if (!uploadResponse.ok) {
      throw new Error('AssemblyAI upload failed');
    }
    
    const { upload_url } = await uploadResponse.json();
    
    // Start transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': process.env.ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        punctuate: true,
        format_text: true
      })
    });
    
    if (!transcriptResponse.ok) {
      throw new Error('AssemblyAI transcript create failed');
    }
    
    const { id } = await transcriptResponse.json();
    
    // Poll for results
    let transcriptData;
    while (true) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'authorization': process.env.ASSEMBLYAI_API_KEY }
      });
      
      transcriptData = await pollResponse.json();
      if (transcriptData.status === 'completed') break;
      if (transcriptData.status === 'error') {
        throw new Error(`AssemblyAI error: ${transcriptData.error}`);
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return NextResponse.json(transcriptData.words || []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
