// netlify/functions/research.js
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { prompt, engine } = JSON.parse(event.body);
    const key = engine === 'claude' 
      ? (process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)
      : (process.env.VITE_GEMINI_KEY || process.env.GOOGLE_API_KEY);

    if (!key) return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing" }) };

    const url = engine === 'claude'
      ? "https://api.anthropic.com/v1/messages"
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(engine === 'claude' && { "x-api-key": key, "anthropic-version": "2025-03-05" })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-sonnet-4-20250514", // The most stable versioned ID
            max_tokens: 4000, 
            messages: [{ role: "user", content: prompt }] 
          }
        : { contents: [{ parts: [{ text: prompt }] }] }
      ),
    });

    const data = await response.json();

    // ERROR PROTECTION: If the API returned an error, send a 400/500 status so App.jsx knows to fallback
    if (data.error || (engine === 'claude' && data.type === "error")) {
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