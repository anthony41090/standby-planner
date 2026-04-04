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

    // API-Level Filters (Stops=1 guarantees NO squashed connecting flights from Google)
    let trunkAirlineQuery = "&stops=1";
    if (trunkFilter) {
      trunkAirlineQuery += `&airlines=${trunkFilter.trim().toUpperCase()}`;
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
          // &stops=1 guarantees connections are also pure nonstop flights
          const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${cleanHubStr}&arrival_id=${cleanFinalStr}&outbound_date=${connectionDate}&type=2&stops=1&api_key=${serpKey}`;
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

    const results = await Promise.all(fetchPromises);
    results.forEach(res => {
      if (res.tData.best_flights) trunkData.best_flights.push(...res.tData.best_flights);
      if (res.tData.other_flights) trunkData.other_flights.push(...res.tData.other_flights);
      if (res.cData.best_flights) connData.best_flights.push(...res.cData.best_flights);
      if (res.cData.other_flights) connData.other_flights.push(...res.cData.other_flights);
    });

    // 3. STRICT FILTERING & DEDUPLICATION
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

    const minimizeFlight = (f) => {
      const leg = f.flights?.[0] || f;
      const depData = splitDateTime(leg.departure_airport?.time || f.departure_airport?.time);
      const arrData = splitDateTime(leg.arrival_airport?.time || f.arrival_airport?.time);

      return {
        airline: leg.airline || f.airline || "",
        flight_number: leg.flight_number || f.flight_number || "",
        origin: (leg.departure_airport?.id || f.departure_airport?.id || "").toUpperCase(),
        dest: (leg.arrival_airport?.id || f.arrival_airport?.id || "").toUpperCase(),
        dep_date: depData.date,
        dep_time: depData.time,
        arr_date: arrData.date,
        arr_time: arrData.time,
        duration_mins: f.total_duration || leg.duration || "Unknown",
        aircraft: leg.airplane || f.airplane || "Unknown"
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
        .filter(f => !f.flights || f.flights.length === 1) 
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
      return (flights || [])
        .filter(f => !f.flights || f.flights.length === 1)
        .map(minimizeFlight);
    };

    const sortByDuration = (a, b) => {
      const durA = typeof a.duration_mins === 'number' ? a.duration_mins : 9999;
      const durB = typeof b.duration_mins === 'number' ? b.duration_mins : 9999;
      return durA - durB;
    };

    const rawTrunkCleaned = dedupeFlights(filterAndMinimizeTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])])).sort(sortByDuration);

    const directFlightsArray = rawTrunkCleaned.filter(f => destArray.includes(f.dest)).slice(0, 20);
    const hubFlightsArray = rawTrunkCleaned.filter(f => !destArray.includes(f.dest)).slice(0, 60);
    const connFlightsArray = dedupeFlights(filterAndMinimizeConnections([...(connData.best_flights || []), ...(connData.other_flights || [])])).sort(sortByDuration).slice(0, 150);

    const liveFlights = {
      direct_flights: directFlightsArray,
      hub_flights: hubFlightsArray,
      connections_from_hubs: connFlightsArray
    };

    const validHubs = [...new Set(hubFlightsArray.map(f => f.dest))];

    console.log(`DEBUG: Found ${directFlightsArray.length} Direct Flights and ${hubFlightsArray.length} Hub Flights.`);

    if (directFlightsArray.length === 0 && hubFlightsArray.length === 0) {
      console.log("CIRCUIT BREAKER: 0 flights found.");
      await setDoc(doc(db, "research", userId), { results: JSON.stringify({ direct_flights: [], hub_routes: [] }), timestamp: new Date().toISOString(), status: "complete" });
      return; 
    }

   // 4. THE ZERO-TOLERANCE SONNET 4.6 PROMPT (MINIFIED)
    const nonStandbyAirlines = ["ZIPAIR", "PEACH", "SPRING", "AIRASIA", "CEBU PACIFIC", "SCOOT", "FRONTIER", "SPIRIT", "RYANAIR", "EASYJET"];
    
    const enhancedPrompt = prompt + `\n\n
    =========================================
    CLEAN LIVE DATA: ${origin} ➔ ${cleanFinalStr}
    =========================================
    ${JSON.stringify(liveFlights)}
    
    CRITICAL DATA INTEGRITY & EXTRACTION RULES:
    1. ZERO TOLERANCE FOR HALLUCINATIONS: You are strictly forbidden from inventing flights. Every flight number MUST be a direct copy-paste from the CLEAN LIVE DATA.
    2. MANDATORY DIRECT FLIGHTS: List every flight found in the "direct_flights" array.
    3. HUB MAPPING: Select UP TO 8 connection options per hub to provide variety.
    4. NON-STANDBY ALERTS: Airlines like ${nonStandbyAirlines.join(', ')} require confirmed tickets. Add ⚠️ warning.
    5. OPTIMIZATION & WARNINGS: Prioritize short durations. Calculate 'tdh' (total duration hrs). Set 'ov' (overnight) and 'ac' (airport change) booleans. Write highly actionable notes (Maximum 50 words).
    6. MINIFIED SCHEMA: To save tokens, you MUST use the exact ultra-short keys provided below. 
       - Do NOT use double quotes (") inside text values. Use single quotes (').
       - NEVER output "TBD".
       {
         "df": [
           { "al": "UA", "fn": "UA 837", "dd": "2026-04-10", "dt": "11:40", "ad": "2026-04-11", "at": "15:00", "air": "777", "or": "SFO", "de": "NRT", "dh": 11, "n": "Direct service." }
         ],
         "hr": [
           {
             "hc": "ICN",
             "hn": "Seoul",
             "ov": true,
             "ac": false,
             "tdh": 24.5,
             "tf": { "al": "UA", "fn": "UA 893", "dd": "2026-04-10", "dt": "10:30", "ad": "2026-04-11", "at": "15:30", "air": "777", "de": "ICN" },
             "cx": [
               { "al": "OZ", "fn": "OZ 102", "or": "ICN", "de": "NRT", "dd": "2026-04-12", "dt": "18:00", "ad": "2026-04-12", "at": "20:30", "lh": 26.5, "ln": "Connect via Seoul." }
             ],
             "h_n": "Overnight required."
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

    // 5. EXPAND MINIFIED JSON BACK TO FULL VERBOSE FORMAT FOR FRONTEND
    let rawJsonText = claudeData.content[0].text;
    const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Claude response");
    
    const minData = JSON.parse(jsonMatch[0]);
    
    const expandedData = {
      direct_flights: (minData.df || []).map(f => ({
        airline: f.al, flight_number: f.fn, departure_date: f.dd, departure_time: f.dt,
        arrival_date: f.ad, arrival_time: f.at, aircraft: f.air, origin: f.or, destination: f.de,
        duration_hrs: f.dh, notes: f.n
      })),
      hub_routes: (minData.hr || []).map(h => ({
        hub_code: h.hc, hub_name: h.hn, overnight_layover: h.ov, airport_change: h.ac,
        total_duration_hrs: h.tdh, hub_notes: h.h_n,
        trunk_flight: h.tf ? {
          airline: h.tf.al, flight_number: h.tf.fn, departure_date: h.tf.dd, departure_time: h.tf.dt,
          arrival_date: h.tf.ad, arrival_time: h.tf.at, aircraft: h.tf.air, destination: h.tf.de, origin: h.tf.or
        } : {},
        connections: (h.cx || []).map(c => ({
          airline: c.al, flight_number: c.fn, origin: c.or, destination: c.de,
          departure_date: c.dd, departure_time: c.dt, arrival_date: c.ad, arrival_time: c.at,
          layover_hrs: c.lh, layover_note: c.ln
        }))
      }))
    };

    await setDoc(doc(db, "research", userId), {
      results: JSON.stringify(expandedData),
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Results expanded and pushed to Firebase.");

  } catch (error) {
    console.error("Error:", error.message);
    await setDoc(doc(db, "research", userId), { status: "error", error: error.message });
  }
};