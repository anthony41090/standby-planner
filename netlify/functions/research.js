// netlify/functions/research.js
export const handler = async (event) => {
  console.log("--- Research Function Started ---");
  
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt, engine } = JSON.parse(event.body);
    
    // BUG FIX: Use Netlify.env.get() instead of process.env 
    // This is the required method for Netlify Functions in 2026
    const key = engine === 'claude' 
      ? Netlify.env.get("VITE_ANTHROPIC_KEY") 
      : Netlify.env.get("VITE_GEMINI_KEY");

    if (!key) {
      console.error(`CRITICAL: Key for ${engine} not found in Netlify.env`);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: `Environment variable for ${engine} is missing.` }) 
      };
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
            // Keep your dashboard happy by requesting the full search tool
            tools: [{ type: "web_search", name: "web_search" }],
            messages: [{ role: "user", content: prompt }] 
          }
        : { 
            contents: [{ parts: [{ text: prompt }] }] 
          }
      ),
    });

    const data = await response.json();
    console.log("--- API Call Successful ---");

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