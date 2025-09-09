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

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'content-type': audioFile.type || 'audio/wav',
      },
      body: audioFile,
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
        word_boost: [],
        auto_highlights: false,
        audio_start_from: 0,
        speaker_labels: false,
        // CRITICAL: Enable word-level timestamps
        timestamps: true,
        disfluencies: false,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcript creation failed: ${transcriptResponse.status} ${errorText}`);
    }

    const { id } = await transcriptResponse.json();

    // Poll for transcription results with a timeout
    const maxPollTime = 60000;
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
        // Return the full transcript data including words array
        return new Response(JSON.stringify(transcriptData), {
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

    throw new Error('Transcription timed out after 60 seconds');
  } catch (error) {
    console.error('AssemblyAI API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
