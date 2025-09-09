// pages/api/summarize.js
export const config = {
  runtime: 'edge',
};

export async function POST(request) {
  try {
    // Parse and validate input
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or missing text input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Truncate text if too long to avoid API limits
    const maxInputLength = 12000;
    const truncatedText = text.length > maxInputLength ? text.substring(0, maxInputLength) + '...' : text;

    // Make request to Fireworks AI API
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new',
        messages: [{
          role: 'user',
          content: `You are Rick Sanchez from Rick and Morty. Summarize the following document in your unique, snarky, and brilliant style. Keep it concise, under 30 words, and explain it like you're talking to Morty. Get to the point, and don't bore me with fluff! Document: ${truncatedText}`,
        }],
        max_tokens: 300,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Summarize API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
