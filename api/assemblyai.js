export const runtime = 'edge';

export async function POST(request) {
  try {
    // Parse the incoming form data
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    // Validate audio file
    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert File/Blob to ArrayBuffer (required for Edge runtime fetch)
    const arrayBuffer = await audioFile.arrayBuffer();

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`AssemblyAI upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const { upload_url } = await uploadResponse.json();

    // Request transcription with word-level timestamps
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
        word_timestamps: true,   // ✅ Required for word-level timestamps
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcript creation failed: ${transcriptResponse.status} ${errorText}`);
    }

    const { id } = await transcriptResponse.json();

    // Poll for transcription results with a timeout
    const maxPollTime = 120000; // 2 min (increase if needed)
    const pollInterval = 2000;
    let elapsedTime = 0;

    while (elapsedTime < maxPollTime) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
        },
      });

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        throw new Error(`AssemblyAI polling failed: ${pollResponse.status} ${errorText}`);
      }

      const transcriptData = await pollResponse.json();

      if (transcriptData.status === 'completed') {
        // ✅ Return the words array with start/end timestamps
        return new Response(JSON.stringify(transcriptData.words || []), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (transcriptData.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${transcriptData.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;
    }

    throw new Error('Transcription timed out after 2 minutes');
  } catch (error) {
    console.error('AssemblyAI API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
