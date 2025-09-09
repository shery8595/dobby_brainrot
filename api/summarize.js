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

    // 🔹 Upload audio to AssemblyAI (with chunking)
    async function uploadToAssemblyAI(file) {
      const chunkSize = 5 * 1024 * 1024; // 5 MB
      const buffer = new Uint8Array(await file.arrayBuffer());

      let uploadUrl = '';
      for (let start = 0; start < buffer.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, buffer.length);
        const chunk = buffer.slice(start, end);

        const resp = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            authorization: process.env.ASSEMBLYAI_API_KEY,
            'content-type': 'application/octet-stream',
          },
          body: chunk,
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Chunk upload failed: ${resp.status} ${errorText}`);
        }

        const data = await resp.json();
        uploadUrl = data.upload_url; // AssemblyAI returns the same upload_url each time
      }

      return uploadUrl;
    }

    const upload_url = await uploadToAssemblyAI(audioFile);

    // 🔹 Request transcription (minimal valid schema)
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        punctuate: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`AssemblyAI transcript creation failed: ${transcriptResponse.status} ${errorText}`);
    }

    const { id } = await transcriptResponse.json();

    // 🔹 Poll for transcription results
    const maxPollTime = 300000; // 5 min
    const pollInterval = 3000;
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
        // ✅ Return the words array with timestamps
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

    throw new Error('Transcription timed out after 5 minutes');
  } catch (error) {
    console.error('AssemblyAI API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
