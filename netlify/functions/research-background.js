const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY, 
  authDomain: "standby-planner.firebaseapp.com",
  databaseURL: "https://standby-planner-default-rtdb.firebaseio.com",
  projectId: "standby-planner"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

exports.handler = async (event) => {
  const { prompt, userId, origin, finalDestination, hubs, date } = JSON.parse(event.body);
  const claudeKey = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  const serpKey = process.env.SERPAPI_KEY;

  try {
    console.log(`Double-Hop Research: ${origin} -> [${hubs}] -> ${finalDestination}`);

    // 1. DYNAMIC DATE LOGIC
    let connectionDate = date; 
    const longHaulRegions = ['NRT', 'HND', 'ICN', 'TPE', 'HKG', 'LHR', 'FRA', 'CDG', 'AMS', 'SYD', 'AKL', 'SIN', 'PEK', 'PVG', 'BKK', 'DXB'];
    const isLongHaul = longHaulRegions.some(code => finalDestination.toUpperCase().includes(code)) || 
                       (hubs && hubs.split(',').some(h => longHaulRegions.includes(h.toUpperCase())));

    if (isLongHaul) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      connectionDate = nextDay.toISOString().split('T')[0];
    }

    // 2. FETCH MULTI-DESTINATION TRUNK (Direct + Hubs)
    const trunkDestinations = hubs ? `${finalDestination},${hubs}` : finalDestination;
    const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${trunkDestinations}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    if (hubs) {
      const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${hubs}&arrival_id=${finalDestination}&outbound_date=${connectionDate}&type=2&api_key=${serpKey}`;
      const [trunkRes, connRes] = await Promise.all([fetch(trunkUrl), fetch(connUrl)]);
      trunkData = await trunkRes.json();
      connData = await connRes.json();
    } else {
      const trunkRes = await fetch(trunkUrl);
      trunkData = await trunkRes.json();
    }

    // 3. DYNAMIC ASYMMETRIC FILTERING (Route-Agnostic)
    // We target any airline SerpApi flags as a 'Best Flight' or major carrier
    const filterAnyMajorCarrier = (flights) => {
      return (flights || []).filter(f => {
        // Deep look for airline info in nested objects
        const airline = f.airline || (f.flights && f.flights[0] && f.flights[0].airline);
        // Exclude low-cost-carriers or Spirit-style airlines if desired, otherwise allow all
        return airline && !airline.toLowerCase().includes("spirit") && !airline.toLowerCase().includes("frontier");
      });
    };

    const liveFlights = {
      // TRUNK: All direct and hub-bound major carriers
      trunk_flights: filterAnyMajorCarrier([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]).slice(0, 20),
      // CONNECTIONS: Purely based on what gets you to the final city
      connection_flights: (connData.best_flights || []).concat(connData.other_flights || []).slice(0, 50)
    };

    console.log(`DEBUG: Found ${liveFlights.trunk_flights.length} major trunk options.`);

    // 4. THE OPTIMIZED SONNET PROMPT
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE DATA: ${origin} ➔ ${finalDestination}
    =========================================
    ${JSON.stringify(liveFlights).substring(0, 95000)}
    
    FINAL EXTRACTION INSTRUCTIONS:
    1. DIRECT FLIGHTS: Extract EVERY non-stop flight from ${origin} to ${finalDestination}. This is the highest priority.
    2. HUB CONNECTIONS: Select the TOP 6 most efficient hub routes via [${hubs}].
    3. DATA COMPLETENESS: Do not discard flights for missing metadata. Use placeholders like "Boeing/Airbus" and "11" for aircraft/duration.
    4. IATA ONLY: Use 3-letter codes for all locations.
    5. JSON: Return ONLY the structured JSON object.`;

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
    if (!claudeData.content || !claudeData.content[0]) throw new Error("Claude Data Missing");

    await setDoc(doc(db, "research", userId), {
      results: claudeData.content[0].text,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Saved to Firebase.");

  } catch (error) {
    console.error("Error:", error.message);
    await setDoc(doc(db, "research", userId), { status: "error", error: error.message });
  }
};