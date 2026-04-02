// netlify/functions/research.js
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { prompt, engine } = JSON.parse(event.body);
  
  const key = engine === 'claude' 
    ? process.env.VITE_ANTHROPIC_KEY 
    : process.env.VITE_GEMINI_KEY;

  // UPDATED: Using v1beta and gemini-2.0-flash to match your App.jsx
  const url = engine === 'claude'
    ? "https://api.anthropic.com/v1/messages"
    : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(engine === 'claude' && {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-3-5-sonnet-20240620", 
            max_tokens: 1024, 
            messages: [{ role: "user", content: prompt }] 
          }
        : { 
            contents: [{ parts: [{ text: prompt }] }] 
          }
      ),
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};