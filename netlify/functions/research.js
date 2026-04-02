// netlify/functions/research.js
export const handler = async (event) => {
  // 1. Log start to help you debug in the Netlify UI
  console.log("--- Research Function Started ---");

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt, engine } = JSON.parse(event.body);
    console.log(`Target Engine: ${engine}`);

    // 2. Access keys using process.env (Standard Node.js way)
    const key = engine === 'claude' 
      ? process.env.VITE_ANTHROPIC_KEY 
      : process.env.VITE_GEMINI_KEY;

    if (!key) {
      console.error(`MISSING KEY: Make sure VITE_${engine.toUpperCase()}_KEY is set in Netlify dashboard with 'Functions' scope.`);
      return { statusCode: 500, body: JSON.stringify({ error: "API Key missing in environment" }) };
    }

    // 3. Define Stable 2026 Endpoints
    const url = engine === 'claude'
      ? "https://api.anthropic.com/v1/messages"
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    // 4. Perform the Fetch
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
            messages: [{ role: "user", content: prompt }] 
          }
        : { 
            contents: [{ parts: [{ text: prompt }] }] 
          }
      ),
    });

    const data = await response.json();
    
    // 5. Final response to your App.jsx
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("Function Error:", error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};