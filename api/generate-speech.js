export const config = { runtime: 'edge' };

export async function POST(request) {
    try {
        const { text, voiceId, stability, similarityBoost } = await request.json();
        if (!text || !voiceId) {
            return new Response(JSON.stringify({ error: 'Missing required fields: text and voiceId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: stability || 0.5,
                    similarity_boost: similarityBoost || 0.5,
                    style: 0.8,
                    use_speaker_boost: true,
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        }
        const audioBuffer = await response.arrayBuffer();
        return new Response(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });
    } catch (error) {
        console.error('Generate speech error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
