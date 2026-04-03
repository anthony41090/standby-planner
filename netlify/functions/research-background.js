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
    // 1. GLOBAL MULTI-DESTINATION LOGIC
    const destArray = finalDestination.split(',').map(d => d.trim().toUpperCase());
    const hubArray = hubs ? hubs.split(',').map(h => h.trim().toUpperCase()) : [];

    // Ensure a destination airport isn't mistakenly used as a "middle-man" hub
    const filteredHubs = hubArray.filter(h => !destArray.includes(h));
    
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

    // 3. FETCH DATA FROM SERPAPI
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

    // 4. STRICT AIRLINE & ORIGIN FILTERING (The Hallucination Killer)
    const filterTrunk = (flights) => {
      const allowedOrigins = origin.split(',').map(o => o.trim().toUpperCase());

      return (flights || []).filter(f => {
        const flightObj = f.flights?.[0] || f;
        const airlineInfo = flightObj.airline || f.airline || "";
        const airline = airlineInfo.toUpperCase();
        
        // Strict Origin Check
        const flightOrigin = (flightObj.departure_airport?.id || f.departure_airport?.id || "").toUpperCase();
        if (flightOrigin && !allowedOrigins.includes(flightOrigin)) return false;
        
        // Strict Trunk Airline Check
        if (trunkFilter && !airline.includes(trunkFilter.toUpperCase())) return false;
        
        // Exclude LCCs without standby agreements for the long-haul
        const excluded = ["SPIRIT", "FRONTIER", "SOUTHWEST", "RYANAIR", "EASYJET", "ZIPAIR"];
        return airline && !excluded.some(e => airline.includes(e));
      });
    };

    const liveFlights = {
      trunk_flights: filterTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]).slice(0, 25),
      connection_flights: [...(connData.best_flights || []), ...(connData.other_flights || [])].slice(0, 50)
    };

    console.log(`DEBUG: Found ${liveFlights.trunk_flights.length} strict trunk options.`);

    // 5. THE OPTIMIZED SONNET 4.6 PROMPT
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE DATA: ${origin} ➔ ${cleanFinalStr}
    =========================================
    ${JSON.stringify(liveFlights).substring(0, 90000)}
    
    CRITICAL DATA INTEGRITY & EXTRACTION RULES:
    1. STRICT ORIGIN: Every trunk flight MUST depart from: ${origin}. IGNORE flights departing from anywhere else.
    2. DIRECT vs HUB:
       - DIRECT: Flights landing exactly in ${cleanFinalStr}.
       - HUB: Flights landing in ${cleanHubStr}. You MUST provide a valid connecting flight from that hub to ${cleanFinalStr}. 
    3. NO QUOTA PANIC (ANTI-HALLUCINATION): You are asked for UP TO 6 hub routes. If the data only has 1 or 2 valid trunk flights departing from ${origin}, ONLY output those 1 or 2 routes. DO NOT invent flights to reach the number 6.
    4. NO HALLUCINATIONS: Do not guess routes. If the data says UA 837 goes to NRT, do not write HND. 
    5. STRICT AIRLINE & CABIN: ${trunkFilter ? `Leg 1 MUST be on ${trunkFilter}.` : "Use major partners."} Prioritize ${cabin === 'J' ? 'Business/First Class' : 'Economy Class'}.
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
    
    if (claudeData.error) throw new Error(`Claude API: ${claudeData.error.message}`);
    if (!claudeData.content?.[0]) throw new Error("Claude Data Missing");

    await setDoc(doc(db, "research", userId), {
      results: claudeData.content[0].text,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Results pushed to Firebase.");

  } catch (error) {
    console.error("Error:", error.message);
    await setDoc(doc(db, "research", userId), { status: "error", error: error.message });
  }
};