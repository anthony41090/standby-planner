// netlify/functions/research-background.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY, 
  authDomain: "standby-planner.firebaseapp.com",
  databaseURL: "https://standby-planner-default-rtdb.firebaseio.com",
  projectId: "standby-planner"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const handler = async (event) => {
  // 1. Unpack the variables sent from App.jsx
  const { prompt, userId, origin, destination, date } = JSON.parse(event.body);

  const claudeKey = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  const serpKey = process.env.SERPAPI_KEY; // We will add this to Netlify in Step 3!

  try {
    console.log(`Research started for: ${userId} | ${origin} -> ${destination} on ${date}`);

    if (!claudeKey || !serpKey) {
      throw new Error("Missing API Keys (Claude or SerpAPI).");
    }

    // ==========================================
    // PHASE 1: Fetch LIVE data from SerpAPI (Google Flights)
    // ==========================================
    console.log("Fetching live schedules from SerpAPI...");
    // type=2 means "One Way". We ask for direct flights and 1-stop connections.
    const serpUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${destination}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
    const serpResponse = await fetch(serpUrl);
    const serpData = await serpResponse.json();

    // We extract the "best_flights" and "other_flights" arrays to give to Claude
    const liveFlights = {
      best_flights: serpData.best_flights || [],
      other_flights: serpData.other_flights || []
    };

    // Compress the data so we don't blow up Claude's token limit
    const compressedFlightData = JSON.stringify(liveFlights).substring(0, 80000); 

    // ==========================================
    // PHASE 2: Claude Acts as the Data Analyst
    // ==========================================
    console.log("Passing live data to Claude for formatting...");
    
    // We append the LIVE data to your original App.jsx prompt
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE FLIGHT DATA FROM GOOGLE FLIGHTS
    =========================================
    ${compressedFlightData}
    
    CRITICAL INSTRUCTIONS:
    1. DO NOT guess or hallucinate schedules. You MUST ONLY use the flights provided in the LIVE FLIGHT DATA above.
    2. Apply the ZED/MIBA airline rules requested to filter this data.
    3. Return strictly valid JSON matching the exact schema requested. No markdown, no conversational text.
    `;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", 
        max_tokens: 4000,
        messages: [{ role: "user", content: enhancedPrompt }]
      })
    });

    const claudeData = await claudeResponse.json();

    if (!claudeData.content) {
        throw new Error("Claude returned no content");
    }

    const finalJsonText = claudeData.content[0].text;

    // ==========================================
    // PHASE 3: Save to Firebase
    // ==========================================
    await setDoc(doc(db, "research", userId), {
      results: finalJsonText,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Results saved to Firebase.");

  } catch (error) {
    console.error("Background Process Error:", error.message);
    await setDoc(doc(db, "research", userId), {
      status: "error",
      error: error.message
    });
  }
};