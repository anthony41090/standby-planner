// netlify/functions/research.js
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { prompt, engine } = JSON.parse(event.body);

    const key = engine === 'claude' 
      ? (process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY)
      : (process.env.VITE_GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY);

    if (!key) return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing" }) };

    const url = engine === 'claude'
      ? "https://api.anthropic.com/v1/messages"
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(engine === 'claude' && { 
          "x-api-key": key, 
          "anthropic-version": "2023-06-01",
          // Required beta header for 2026 server tools
          "anthropic-beta": "token-efficient-tools-2025-02-19" 
        })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-3-5-sonnet-20240620", 
            max_tokens: 4000, 
            tools: [
              { 
                // FIXED: Changed 'web_search' to the specific 2026 versioned type
                type: "web_search_20260209", 
                name: "web_search" 
              }
            ],
            messages: [{ role: "user", content: prompt }] 
          }
        : { contents: [{ parts: [{ text: prompt }] }] }
      ),
    });

    const data = await response.json();

    if (data.error || (engine === 'claude' && data.type === "error")) {
      console.error(`${engine.toUpperCase()} API Error:`, data.error);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};