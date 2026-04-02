// netlify/functions/research.js
export const handler = async (event) => {
  console.log("--- Research Function Started ---");
  
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt, engine } = JSON.parse(event.body);
    console.log(`Target Engine: ${engine}`);

    // Standard Node.js access for Serverless Functions
    const key = engine === 'claude' 
      ? process.env.VITE_ANTHROPIC_KEY 
      : process.env.VITE_GEMINI_KEY;

    if (!key) {
      console.error(`Error: API Key for ${engine} is missing in process.env`);
      return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing" }) };
    }

    const url = engine === 'claude'
      ? "https://api.anthropic.com/v1/messages"
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(engine === 'claude' && {
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-3-5-sonnet-20240620", 
            max_tokens: 4000,
            // Re-adding the tools so Claude can actually find your routes
            tools: [{ type: "web_search", name: "web_search" }],
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
    console.error("Function Crash:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};