// netlify/functions/research.js
export const handler = async (event) => {
  console.log("--- Research Function Started ---");
  
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt, engine } = JSON.parse(event.body);
    console.log(`Target Engine: ${engine}`);

    // Try multiple naming conventions to bypass Netlify's environment sync issues
    const key = engine === 'claude' 
      ? (process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY)
      : (process.env.VITE_GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY);

    if (!key || key === "undefined") {
      console.error(`CRITICAL: API Key for ${engine} is missing in the function environment.`);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: `API Key for ${engine} is not available at runtime.` }) 
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
          "anthropic-version": "2023-06-01", // FIXED: Per Anthropic documentation
          "anthropic-beta": "token-efficient-tools-2025-02-19,fast-mode-2026-02-01" // 2026 Validated Betas
        })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-3-5-sonnet-20240620", 
            max_tokens: 4000, 
            tools: [{ type: "web_search", name: "web_search" }],
            messages: [{ role: "user", content: prompt }] 
          }
        : { 
            contents: [{ parts: [{ text: prompt }] }] 
          }
      ),
    });

    const data = await response.json();

    // If the API returned a formal error (like 400 Bad Request), pass it through
    // so App.jsx can trigger the Gemini fallback.
    if (data.error || (engine === 'claude' && data.type === "error")) {
      console.error(`${engine.toUpperCase()} API Error Detail:`, data.error);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    console.log(`--- ${engine.toUpperCase()} API Success ---`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("Internal Function Error:", error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};