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
      ? (process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)
      : (process.env.VITE_GEMINI_KEY || process.env.GOOGLE_API_KEY);

    if (!key || key === "undefined") {
      console.error(`CRITICAL ERROR: Key for ${engine} is missing in the runtime environment.`);
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
          "anthropic-version": "2023-06-01"
        })
      },
      body: JSON.stringify(
        engine === 'claude' 
        ? { 
            model: "claude-3-5-sonnet-latest", 
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }] 
          }
        : { 
            contents: [{ parts: [{ text: prompt }] }] 
          }
      )
    }); // <--- THIS was the missing section causing all 9 errors

    const data = await response.json();
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