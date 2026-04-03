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

    // Google Flights API limit is ~7 arrival airports. We batch hubs into chunks of 5.
    const chunkSize = 5;
    const hubChunks = [];
    for (let i = 0; i < filteredHubs.length; i += chunkSize) {
      hubChunks.push(filteredHubs.slice(i, i + chunkSize));
    }
    // Ensure at least one batch runs even if there are 0 hubs (for direct flights)
    if (hubChunks.length === 0) hubChunks.push([]); 

    console.log(`Double-Hop Research: ${origin} -> [${filteredHubs.join(',')}] -> ${cleanFinalStr} (Running in ${hubChunks.length} parallel batches)`);

    // 2. CONCURRENT API FETCHING
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    const fetchPromises = hubChunks.map(async (chunk) => {
      const cleanHubStr = chunk.join(',');
      const allSearchTargetsStr = [...new Set([...destArray, ...chunk])].join(',');

      // Dynamic Date Logic per batch
      let connectionDate = date; 
      const longHaulRegions = ['NRT', 'HND', 'ICN', 'TPE', 'HKG', 'LHR', 'FRA', 'CDG', 'AMS', 'SYD', 'AKL', 'SIN', 'PEK', 'PKX', 'PVG', 'BKK', 'DXB', 'KIX'];
      const isLongHaul = longHaulRegions.some(code => cleanFinalStr.includes(code)) || 
                         chunk.some(h => longHaulRegions.includes(h));

      if (isLongHaul) {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        connectionDate = nextDay.toISOString().split('T')[0];
      }

      const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${allSearchTargetsStr}&outbound_date=${date}&type=2&api_key=${serpKey}`;
      
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

    // Wait for all batches to finish and merge the data
    const results = await Promise.all(fetchPromises);
    results.forEach(res => {
      if (res.tData.best_flights) trunkData.best_flights.push(...res.tData.best_flights);
      if (res.tData.other_flights) trunkData.other_flights.push(...res.tData.other_flights);
      if (res.cData.best_flights) connData.best_flights.push(...res.cData.best_flights);
      if (res.cData.other_flights) connData.other_flights.push(...res.cData.other_flights);
    });

    const rawTrunkTotal = trunkData.best_flights.length + trunkData.other_flights.length;
    console.log(`API RAW TRUNK FLIGHTS RETURNED (Merged): ${rawTrunkTotal}`);

    // 3. STRICT FILTERING, MINIFICATION, & DEDUPLICATION
    const allowedOrigins = origin.split(',').map(o => o.trim().toUpperCase());
    const allSearchTargets = [...new Set([...destArray, ...filteredHubs])];

    const AIRLINE_NAMES = {
      "UA": "UNITED", "AA": "AMERICAN", "DL": "DELTA", "AS": "ALASKA", "HA": "HAWAIIAN", "WN": "SOUTHWEST", "B6": "JETBLUE", "F9": "FRONTIER", "NK": "SPIRIT", "SY": "SUN COUNTRY", "G4": "ALLEGIANT", "MX": "BREEZE", "XE": "JSX",
      "AC": "AIR CANADA", "WS": "WESTJET", "PD": "PORTER", "TS": "TRANSAT", "AM": "AEROMEXICO", "Y4": "VOLARIS", "VB": "VIVA",
      "BA": "BRITISH", "LH": "LUFTHANSA", "AF": "AIR FRANCE", "KL": "KLM", "IB": "IBERIA", "AY": "FINNAIR", "SK": "SAS", "TP": "TAP", "EI": "AER LINGUS", "AZ": "ITA", "U2": "EASYJET", "FR": "RYANAIR", "W6": "WIZZ", "VS": "VIRGIN ATLANTIC", "LX": "SWISS", "OS": "AUSTRIAN", "SN": "BRUSSELS", "TK": "TURKISH", "A3": "AEGEAN", "FI": "ICELANDAIR", "UX": "AIR EUROPA", "VY": "VUELING", "EW": "EUROWINGS", "DE": "CONDOR", "LO": "LOT", "B0": "LA COMPAGNIE", "4Y": "DISCOVER", "N0": "NORSE",
      "JL": "JAPAN", "NH": "NIPPON", "KE": "KOREAN", "OZ": "ASIANA", "CX": "CATHAY", "BR": "EVA", "CI": "CHINA AIRLINES", "SQ": "SINGAPORE", "MH": "MALAYSIA", "TG": "THAI", "VN": "VIETNAM", "PR": "PHILIPPINE", "GA": "GARUDA", "CA": "AIR CHINA", "MU": "CHINA EASTERN", "CZ": "CHINA SOUTHERN", "HU": "HAINAN", "3U": "SICHUAN", "HO": "JUNEYAO", "MF": "XIAMEN", "ZH": "SHENZHEN", "SC": "SHANDONG", "UO": "EXPRESS", "HX": "HONG KONG", "JQ": "JETSTAR", "GK": "JETSTAR", "TR": "SCOOT", "5J": "CEBU", "ZG": "ZIPAIR", "MM": "PEACH", "IT": "TIGERAIR", "D7": "AIRASIA", "AK": "AIRASIA", "BX": "AIR BUSAN", "LJ": "JINAIR", "7C": "JEJU", "TW": "T'WAY", "RS": "AIR SEOUL", "ZE": "EASTAR",
      "EK": "EMIRATES", "QR": "QATAR", "EY": "ETIHAD", "SV": "SAUDIA", "RJ": "ROYAL JORDANIAN", "GF": "GULF", "WY": "OMAN", "LY": "EL AL", "SA": "SOUTH AFRICAN", "ET": "ETHIOPIAN", "MS": "EGYPTAIR", "AT": "ROYAL AIR", "KQ": "KENYA", "XY": "FLYNAS",
      "LA": "LATAM", "CM": "COPA", "AV": "AVIANCA", "AR": "AEROLINEAS ARGENTINAS", "G3": "GOL", "AD": "AZUL", "QF": "QANTAS", "VA": "VIRGIN AUSTRALIA", "NZ": "NEW ZEALAND", "FJ": "FIJI"
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

    // Deduplication Engine: Removes identical flights merged from different batches
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

    // We deduplicate trunks and bump the slice size to 60/150 to pass more data
    const liveFlights = {
      trunk_flights: dedupeFlights(filterAndMinimizeTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])])).slice(0, 60),
      connection_flights: dedupeFlights(filterAndMinimizeConnections([...(connData.best_flights || []), ...(connData.other_flights || [])])).slice(0, 150)
    };

    console.log(`DEBUG: After deduplication & filtering: ${liveFlights.trunk_flights.length} valid trunk options remain.`);

    // CIRCUIT BREAKER
    if (liveFlights.trunk_flights.length === 0) {
      console.log("CIRCUIT BREAKER: 0 trunk flights found. Aborting Claude to prevent hallucinations.");
      await setDoc(doc(db, "research", userId), {
        results: JSON.stringify({ direct_flights: [], hub_routes: [] }),
        timestamp: new Date().toISOString(),
        status: "complete"
      });
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
    1. ZERO TOLERANCE FOR HALLUCINATIONS: You are strictly forbidden from inventing flights or using pre-trained knowledge. Every single flight number, airline, departure time, and arrival time you output MUST be a direct copy-paste from the CLEAN LIVE DATA provided above.
    2. MANDATORY DIRECT FLIGHTS: Extract and list EVERY direct flight from ${origin} to ${cleanFinalStr} found EXACTLY in the LIVE DATA.
    3. STRICT CONNECTIONS (NO "VARIES"): For hub routes, list each connecting flight individually. NEVER summarize connections.
    4. HUB LIMIT & COVERAGE: Select UP TO 10 hub routes total. Evaluate flights to (${filteredHubs.join(',')}). IF A HUB HAS NO TRUNK FLIGHT IN THE LIVE DATA, SKIP IT.
    5. STRICT AIRLINE: ${trunkFilter ? `Leg 1 MUST be on ${trunkFilter}.` : "Use major partners."} Prioritize ${cabin === 'J' ? 'Business/First Class' : 'Economy Class'}.
    6. NON-STANDBY ALERTS: Airlines such as ${nonStandbyAirlines.join(', ')} are NOT standby eligible. If you include them, you MUST add this exact text to the notes: ⚠️ [Airline Name] is not standby eligible (confirmed ticket required). DO NOT use internal quotation marks around this text.
    7. STRICT JSON SYNTAX: Return ONLY the structured JSON object. Ensure all string values are properly escaped. Do not use unescaped quotation marks inside your text fields.`;

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