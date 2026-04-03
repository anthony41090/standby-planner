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
  const { prompt, userId, origin, finalDestination, hubs, date } = JSON.parse(event.body);

  const claudeKey = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  const serpKey = process.env.SERPAPI_KEY;

  try {
    console.log(`Double-Hop Research started: ${origin} -> Hubs -> ${finalDestination}`);

    // Transpacific flights arrive the next calendar day. We need connections for tomorrow.
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const connectionDate = nextDay.toISOString().split('T')[0];

   // If hubs exist, append them. Otherwise, just search the final destination.
    const trunkDestinations = hubs ? `${finalDestination},${hubs}` : finalDestination;
    const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${trunkDestinations}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    console.log("Fetching Trunk schedules...");
    
    if (hubs) {
      console.log(`Hubs detected (${hubs}). Fetching Connections simultaneously...`);
      const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${hubs}&arrival_id=${finalDestination}&outbound_date=${connectionDate}&type=2&api_key=${serpKey}`;
      
      // Fire both searches at the exact same time
      const [trunkRes, connRes] = await Promise.all([fetch(trunkUrl), fetch(connUrl)]);
      trunkData = await trunkRes.json();
      connData = await connRes.json();
    } else {
      console.log("No hubs required. Fetching direct/standard routes only.");
      const trunkRes = await fetch(trunkUrl);
      trunkData = await trunkRes.json();
    }

    // Combine best and other flights into clean arrays
    const liveFlights = {
      trunk_flights: [...(trunkData.best_flights || []), ...(trunkData.other_flights || [])],
      connection_flights: [...(connData.best_flights || []), ...(connData.other_flights || [])]
    };

    const compressedFlightData = JSON.stringify(liveFlights).substring(0, 90000);

    console.log("Passing 2-stage live data to Claude...");
    
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE FLIGHT DATA (2-STAGE ROUTING)
    =========================================
    ${compressedFlightData}
    
    CRITICAL INSTRUCTIONS:
    1. DATA INTEGRITY: You MUST cross-reference flight numbers exactly. UA 879 and UA 881 are NOT SFO-Tokyo flights. Only use flight numbers explicitly listed for the SFO departure in the LIVE DATA.
    2. ANCHORING: For every flight, you MUST include the "aircraft" and "duration_hrs" fields. If you cannot find these for a specific flight number, do not include that flight.
    3. STITCHING: Ensure Hub connections (ICN, TPE, etc.) depart at least 1.5 hours AFTER the trunk flight arrives.
    4. STRICT CODES: Use 2-letter IATA codes (UA, NH, JL) for all "airline" fields.
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
        max_tokens: 8192,
        messages: [{ role: "user", content: enhancedPrompt }]
      })
    });

    const claudeData = await claudeResponse.json();
    const finalJsonText = claudeData.content[0].text;

    await setDoc(doc(db, "research", userId), {
      results: finalJsonText,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Double-Hop Results saved to Firebase.");

  } catch (error) {
    console.error("Background Process Error:", error.message);
    await setDoc(doc(db, "research", userId), { status: "error", error: error.message });
  }
};