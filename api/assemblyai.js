// pages/api/assemblyai.js
export const runtime = 'edge';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
      },
      body: audioFile,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`AssemblyAI upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Start transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcript creation failed: ${transcriptResponse.status} ${errorText}`);
    }

    const { id } = await transcriptResponse.json();

    // Poll for results
    let transcriptData;
    while (true) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
      });

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        throw new Error(`AssemblyAI polling failed: ${pollResponse.status} ${errorText}`);
      }

      transcriptData = await pollResponse.json();
      if (transcriptData.status === 'completed') {
        break;
      }
      if (transcriptData.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${transcriptData.error}`);
      }

      // Wait 2 seconds before polling again to reduce Edge Runtime CPU usage
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Return word-level timestamps or empty array if none
    return new Response(JSON.stringify(transcriptData.words || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AssemblyAI API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
