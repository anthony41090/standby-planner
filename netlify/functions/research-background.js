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
  const { prompt, userId, origin, finalDestination, hubs, date, trunkFilter, cabin } = JSON.parse(event.body);
  const claudeKey = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  const serpKey = process.env.SERPAPI_KEY;

  try {
    // 1. GLOBAL MULTI-DESTINATION LOGIC (ROOT CAUSE FIX)
    // Convert comma-strings into clean Arrays
    const destArray = finalDestination.split(',').map(d => d.trim().toUpperCase());
    const hubArray = hubs ? hubs.split(',').map(h => h.trim().toUpperCase()) : [];

    // Filter Hubs: Remove any airport that is already a final destination (e.g., move HND out of hubs)
    const filteredHubs = hubArray.filter(h => !destArray.includes(h));
    
    // Reconstruct strings for the search engine
    const cleanFinalStr = destArray.join(',');
    const cleanHubStr = filteredHubs.join(',');
    const allSearchTargets = [...new Set([...destArray, ...filteredHubs])].join(',');

    console.log(`Double-Hop Research: ${origin} -> [${cleanHubStr}] -> ${cleanFinalStr}`);

    // 2. DYNAMIC DATE LOGIC
    let connectionDate = date; 
    const longHaulRegions = ['NRT', 'HND', 'ICN', 'TPE', 'HKG', 'LHR', 'FRA', 'CDG', 'AMS', 'SYD', 'AKL', 'SIN', 'PEK', 'PKX', 'PVG', 'BKK', 'DXB', 'KIX'];
    const isLongHaul = longHaulRegions.some(code => cleanFinalStr.includes(code)) || 
                       filteredHubs.some(h => longHaulRegions.includes(h));

    if (isLongHaul) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      connectionDate = nextDay.toISOString().split('T')[0];
    }

    // 3. FETCH DATA
    const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${allSearchTargets}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    if (cleanHubStr) {
      const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${cleanHubStr}&arrival_id=${cleanFinalStr}&outbound_date=${connectionDate}&type=2&api_key=${serpKey}`;
      const [trunkRes, connRes] = await Promise.all([fetch(trunkUrl), fetch(connUrl)]);
      trunkData = await trunkRes.json();
      connData = await connRes.json();
    } else {
      const trunkRes = await fetch(trunkUrl);
      trunkData = await trunkRes.json();
    }

    // 4. STRICT AIRLINE & CABIN FILTERING
    const filterTrunk = (flights) => {
      return (flights || []).filter(f => {
        const airlineInfo = f.airline || (f.flights && f.flights[0] && f.flights[0].airline) || "";
        const airline = airlineInfo.toUpperCase();
        
        // If user explicitly selected a trunk airline (e.g., UA), only show that carrier
        if (trunkFilter) {
          return airline.includes(trunkFilter.toUpperCase());
        }
        
        // Broad search fallback: exclude LCCs that don't have standby agreements
        const excluded = ["SPIRIT", "FRONTIER", "SOUTHWEST", "RYANAIR", "EASYJET"];
        return airline && !excluded.some(e => airline.includes(e));
      });
    };

    const liveFlights = {
      // Directs to ANY destination airport + all Hubs
      trunk_flights: filterTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]).slice(0, 25),
      // Connections from Hubs to ANY of the destination airports
      connection_flights: [...(connData.best_flights || []), ...(connData.other_flights || [])].slice(0, 50)
    };

    console.log(`DEBUG: Found ${liveFlights.trunk_flights.length} filtered trunk options.`);

    // 5. THE OPTIMIZED SONNET PROMPT
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE DATA: ${origin} ➔ ${cleanFinalStr}
    =========================================
    ${JSON.stringify(liveFlights).substring(0, 95000)}
    
    CRITICAL EXTRACTION RULES:
    1. WIN STATE: A flight from ${origin} to ANY of these airports is a DIRECT flight: ${cleanFinalStr}.
    2. HUB LIMIT: Select ONLY the TOP 6 hub routes total.
    3. NO INTERNAL TRIPS: Do not suggest connections between destination airports (e.g., EWR to JFK).
    4. AIRLINE PRIORITY: ${trunkFilter ? `Leg 1 MUST be on ${trunkFilter}.` : "Use major partner carriers."}
    5. CABIN: Target ${cabin === 'J' ? 'Business/First Class' : 'Economy Class'}.
    6. JSON ONLY: Return ONLY the structured JSON object.`;

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