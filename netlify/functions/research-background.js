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
    // 1. GLOBAL MULTI-DESTINATION & BATCHING LOGIC
    const destArray = finalDestination.split(',').map(d => d.trim().toUpperCase());
    const hubArray = hubs ? hubs.split(',').map(h => h.trim().toUpperCase()) : [];
    const filteredHubs = hubArray.filter(h => !destArray.includes(h));
    const cleanFinalStr = destArray.join(',');

    const chunkSize = 5;
    const hubChunks = [];
    for (let i = 0; i < filteredHubs.length; i += chunkSize) {
      hubChunks.push(filteredHubs.slice(i, i + chunkSize));
    }
    if (hubChunks.length === 0) hubChunks.push([]); 

    console.log(`Double-Hop Research: ${origin} -> [${filteredHubs.join(',')}] -> ${cleanFinalStr} (Running in ${hubChunks.length + 1} parallel batches)`);

    // API-Level Airline Filter
    let trunkAirlineQuery = "";
    if (trunkFilter) {
      trunkAirlineQuery = `&airlines=${trunkFilter.trim().toUpperCase()}`;
    }

    // 2. CONCURRENT API FETCHING
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    // BATCH A: Hub Chunks
    const fetchPromises = hubChunks.map(async (chunk) => {
      const cleanHubStr = chunk.join(',');
      const allSearchTargetsStr = [...new Set([...destArray, ...chunk])].join(',');

      let connectionDate = date; 
      const longHaulRegions = ['NRT', 'HND', 'ICN', 'TPE', 'HKG', 'LHR', 'FRA', 'CDG', 'AMS', 'SYD', 'AKL', 'SIN', 'PEK', 'PKX', 'PVG', 'BKK', 'DXB', 'KIX'];
      const isLongHaul = longHaulRegions.some(code => cleanFinalStr.includes(code)) || chunk.some(h => longHaulRegions.includes(h));

      if (isLongHaul) {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        connectionDate = nextDay.toISOString().split('T')[0];
      }

      const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${allSearchTargetsStr}&outbound_date=${date}&type=2${trunkAirlineQuery}&api_key=${serpKey}`;
      
      let tData = { best_flights: [], other_flights: [] };
      let cData = { best_flights: [], other_flights: [] };

      try {
        if (cleanHubStr) {
          const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${cleanHubStr}&arrival_id=${cleanFinalStr}&outbound_date=${connectionDate}&type=2&api_key=${serpKey}`;
          const [tRes, cRes] = await Promise.all([fetch(trunkUrl), fetch(connUrl)]);
          tData = await tRes.json();
          cData = await cRes.json();
        } else {
          const tRes = await fetch(trunkUrl);
          tData = await tRes.json();
        }
      } catch (err) {
        console.error(`Batch Fetch Error for chunk [${cleanHubStr}]:`, err.message);
      }
      return { tData, cData };
    });

    // BATCH B: Dedicated Direct Flights
    const directPromise = async () => {
      try {
        const directUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${cleanFinalStr}&outbound_date=${date}&type=2${trunkAirlineQuery}&api_key=${serpKey}`;
        const res = await fetch(directUrl);
        const tData = await res.json();
        return { tData, cData: { best_flights: [], other_flights: [] } };
      } catch (err) {
        console.error(`Direct Fetch Error:`, err.message);
        return { tData: { best_flights: [], other_flights: [] }, cData: { best_flights: [], other_flights: [] } };
      }
    };
    
    fetchPromises.push(directPromise());

    // Merge Data
    const results = await Promise.all(fetchPromises);
    results.forEach(res => {
      if (res.tData.best_flights) trunkData.best_flights.push(...res.tData.best_flights);
      if (res.tData.other_flights) trunkData.other_flights.push(...res.tData.other_flights);
      if (res.cData.best_flights) connData.best_flights.push(...res.cData.best_flights);
      if (res.cData.other_flights) connData.other_flights.push(...res.cData.other_flights);
    });

    // 3. STRICT FILTERING, MINIFICATION, & DEDUPLICATION
    const allowedOrigins = origin.split(',').map(o => o.trim().toUpperCase());
    const allSearchTargets = [...new Set([...destArray, ...filteredHubs])];

    const AIRLINE_NAMES = {
      "UA": "UNITED", "AA": "AMERICAN", "DL": "DELTA", "AS": "ALASKA", "HA": "HAWAIIAN"
    };

    const splitDateTime = (timeStr) => {
      if (!timeStr) return { date: "", time: "" };
      const parts = timeStr.split(' ');
      return { date: parts[0] || "", time: parts[1] || timeStr };
    };

    // FIXED: Accurately maps the first and last legs so times are never blank
    const minimizeFlight = (f) => {
      const firstLeg = f.flights?.[0] || f;
      const lastLeg = f.flights?.[f.flights?.length - 1] || firstLeg;

      const depData = splitDateTime(firstLeg.departure_airport?.time || f.departure_airport?.time);
      const arrData = splitDateTime(lastLeg.arrival_airport?.time || f.arrival_airport?.time);

      return {
        airline: firstLeg.airline || f.airline || "",
        flight_number: firstLeg.flight_number || f.flight_number || "",
        origin: (firstLeg.departure_airport?.id || f.departure_airport?.id || "").toUpperCase(),
        dest: (lastLeg.arrival_airport?.id || f.arrival_airport?.id || "").toUpperCase(),
        dep_date: depData.date,
        dep_time: depData.time,
        arr_date: arrData.date,
        arr_time: arrData.time,
        duration_mins: f.total_duration || firstLeg.duration || "Unknown",
        aircraft: firstLeg.airplane || f.airplane || "Unknown"
      };
    };

    const dedupeFlights = (flights) => {
      const seen = new Set();
      return flights.filter(f => {
        const key = `${f.flight_number}-${f.dep_time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const filterAndMinimizeTrunk = (flights) => {
      return (flights || [])
        .map(minimizeFlight)
        .filter(f => {
          if (!f.origin || !allowedOrigins.includes(f.origin)) return false;
          if (!f.dest || !allSearchTargets.includes(f.dest)) return false;
          
          if (trunkFilter) {
            const filterCode = trunkFilter.trim().toUpperCase();
            const filterName = AIRLINE_NAMES[filterCode] || filterCode;
            const airlineUpper = f.airline.toUpperCase();
            const flightNumUpper = f.flight_number.toUpperCase();

            if (!airlineUpper.includes(filterName) && !airlineUpper.includes(filterCode) && !flightNumUpper.includes(filterCode)) {
              return false;
            }
          }
          return true;
        });
    };

    const filterAndMinimizeConnections = (flights) => {
      return (flights || []).map(minimizeFlight);
    };

    const sortByDuration = (a, b) => {
      const durA = typeof a.duration_mins === 'number' ? a.duration_mins : 9999;
      const durB = typeof b.duration_mins === 'number' ? b.duration_mins : 9999;
      return durA - durB;
    };

    const liveFlights = {
      trunk_flights: dedupeFlights(filterAndMinimizeTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]))
        .sort(sortByDuration)
        .slice(0, 80),
      connection_flights: dedupeFlights(filterAndMinimizeConnections([...(connData.best_flights || []), ...(connData.other_flights || [])]))
        .sort(sortByDuration)
        .slice(0, 150)
    };

    const validTrunkDests = [...new Set(liveFlights.trunk_flights.map(f => f.dest))];
    const validHubs = filteredHubs.filter(h => validTrunkDests.includes(h));

    console.log(`DEBUG: After filtering: ${liveFlights.trunk_flights.length} valid trunk options remain.`);
    console.log(`DEBUG: Pre-Validated Hubs with actual flights: ${validHubs.join(', ') || "None"}`);

    if (liveFlights.trunk_flights.length === 0) {
      console.log("CIRCUIT BREAKER: 0 trunk flights found.");
      await setDoc(doc(db, "research", userId), { results: JSON.stringify({ direct_flights: [], hub_routes: [] }), timestamp: new Date().toISOString(), status: "complete" });
      return; 
    }

   // 4. THE ZERO-TOLERANCE SONNET 4.6 PROMPT
    const nonStandbyAirlines = ["ZIPAIR", "PEACH", "SPRING", "AIRASIA", "CEBU PACIFIC", "SCOOT", "FRONTIER", "SPIRIT", "RYANAIR", "EASYJET"];
    
    const enhancedPrompt = prompt + `\n\n
    =========================================
    CLEAN LIVE DATA: ${origin} ➔ ${cleanFinalStr}
    =========================================
    ${JSON.stringify(liveFlights)}
    
    CRITICAL DATA INTEGRITY & EXTRACTION RULES:
    1. ZERO TOLERANCE FOR HALLUCINATIONS: You are strictly forbidden from inventing flights. Every flight number MUST be a direct copy-paste from the CLEAN LIVE DATA.
    2. MANDATORY DIRECT FLIGHTS: Extract and list EVERY direct flight from ${origin} to ${cleanFinalStr} found EXACTLY in the LIVE DATA.
    3. HUB LIMIT & COVERAGE: Select UP TO 10 hub routes total. Evaluate ONLY these valid hubs: (${validHubs.join(',')}). 
       - CRITICAL MAP RULE: The trunk flight's destination MUST EXACTLY MATCH the hub_code. 
    4. NON-STANDBY ALERTS: Airlines such as ${nonStandbyAirlines.join(', ')} are NOT standby eligible. Add a note: ⚠️ [Airline Name] is not standby eligible (confirmed ticket required).
    5. NON-REV OPTIMIZATION: Prioritize routes with the shortest total durations and larger widebody aircraft (e.g., 777, 787, A350, A380).
    6. STRICT JSON FORMATTING & SCHEMA: 
       - Return ONLY the raw JSON object. Do NOT wrap the JSON in markdown code blocks.
       - Start your response exactly with the { character.
       - DO NOT use double quotation marks (") inside ANY of your text values or notes. Use single quotes (') instead.
       - NEVER output "TBD" for times. Extract the exact dep_time and arr_time from the JSON data.
       - You MUST use this exact JSON schema structure, ensuring arrival_time is included on EVERY flight leg:
       {
         "direct_flights": [
           { "airline": "UA", "flight_number": "UA 837", "departure_time": "11:40", "arrival_time": "15:00", "aircraft": "777", "origin": "SFO", "destination": "NRT", "duration_hrs": 11, "notes": "Direct service" }
         ],
         "hub_routes": [
           {
             "hub_code": "ICN",
             "hub_name": "Seoul",
             "trunk_flight": { "airline": "UA", "flight_number": "UA 893", "departure_time": "10:30", "arrival_time": "15:30", "aircraft": "777", "destination": "ICN" },
             "connections": [
               { "airline": "OZ", "flight_number": "OZ 102", "destination": "NRT", "departure_time": "18:00", "arrival_time": "20:30", "layover_hrs": 3 }
             ],
             "hub_notes": "Connect via Seoul."
           }
         ]
       }`;

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