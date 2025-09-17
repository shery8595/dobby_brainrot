export const config = { runtime: 'edge' };

export async function POST(request) {
    try {
        const { text } = await request.json();
        
        if (!text) {
            return new Response(JSON.stringify({ error: 'Missing required field: text' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if Fireworks API key is available
        if (!process.env.FIREWORKS_API_KEY) {
            return new Response(JSON.stringify({ error: 'Fireworks API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const truncatedText = text.length > 8000 ? text.substring(0, 8000) + "..." : text;
        
        const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.FIREWORKS_API_KEY
            },
            body: JSON.stringify({
                model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
                messages: [
                    {
                        role: "system",
                        content: `You are Dobby, an AI assistant that analyzes documents and selects the most appropriate video topic category. 

Available video categories:
- Technology & AI (neural, network, artificial, intelligence, machine, learning, algorithm, computer, software, programming, code, data, database, technology)
- Science & Nature (science, biology, chemistry, physics, nature, environment, climate, energy, research)
- Business & Finance (business, finance, economy, market, investment, management, strategy)
- Health & Medicine (health, medical, medicine, treatment, therapy, patient)
- Education & Research (education, study, academic, university, student)
- Space & Astronomy (space, astronomy, planet, universe, galaxy, cosmic)

Analyze the given document and respond with ONLY the most relevant category name from the list above. If the document doesn't clearly fit any category, respond with "default".`
                    },
                    {
                        role: "user",
                        content: `Analyze this document and tell me which video category it belongs to:\n\n${truncatedText}`
                    }
                ],
                max_tokens: 50,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fireworks API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const topicCategory = data.choices[0].message.content.trim().toLowerCase();
        
        return new Response(JSON.stringify({ topic: topicCategory }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        
    } catch (error) {
        console.error('Get topic error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
