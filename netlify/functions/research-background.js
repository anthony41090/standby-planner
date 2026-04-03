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

    const filteredHubs = hubArray.filter(h => !destArray.includes(h));
    
    const cleanFinalStr = destArray.join(',');
    const cleanHubStr = filteredHubs.join(',');
    const allSearchTargets = [...new Set([...destArray, ...filteredHubs])];
    const allSearchTargetsStr = allSearchTargets.join(',');

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
    const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${allSearchTargetsStr}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
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

    // 4. STRICT FILTERING & DATA MINIFICATION
    const allowedOrigins = origin.split(',').map(o => o.trim().toUpperCase());

    // GLOBAL TRANSLATOR: Maps 2-letter codes to Google Flights primary brand names
    const AIRLINE_NAMES = {
      // North America
      "UA": "UNITED", "AA": "AMERICAN", "DL": "DELTA", "AS": "ALASKA", "HA": "HAWAIIAN", "WN": "SOUTHWEST", "B6": "JETBLUE", "F9": "FRONTIER", "NK": "SPIRIT", "SY": "SUN COUNTRY", "G4": "ALLEGIANT", "MX": "BREEZE", "XE": "JSX",
      "AC": "AIR CANADA", "WS": "WESTJET", "PD": "PORTER", "TS": "TRANSAT", "AM": "AEROMEXICO", "Y4": "VOLARIS", "VB": "VIVA",
      // Europe
      "BA": "BRITISH", "LH": "LUFTHANSA", "AF": "AIR FRANCE", "KL": "KLM", "IB": "IBERIA", "AY": "FINNAIR", "SK": "SAS", "TP": "TAP", "EI": "AER LINGUS", "AZ": "ITA", "U2": "EASYJET", "FR": "RYANAIR", "W6": "WIZZ", "VS": "VIRGIN ATLANTIC", "LX": "SWISS", "OS": "AUSTRIAN", "SN": "BRUSSELS", "TK": "TURKISH", "A3": "AEGEAN", "FI": "ICELANDAIR", "UX": "AIR EUROPA", "VY": "VUELING", "EW": "EUROWINGS", "DE": "CONDOR", "LO": "LOT", "B0": "LA COMPAGNIE", "4Y": "DISCOVER", "N0": "NORSE",
      // Asia
      "JL": "JAPAN", "NH": "NIPPON", "KE": "KOREAN", "OZ": "ASIANA", "CX": "CATHAY", "BR": "EVA", "CI": "CHINA AIRLINES", "SQ": "SINGAPORE", "MH": "MALAYSIA", "TG": "THAI", "VN": "VIETNAM", "PR": "PHILIPPINE", "GA": "GARUDA", "CA": "AIR CHINA", "MU": "CHINA EASTERN", "CZ": "CHINA SOUTHERN", "HU": "HAINAN", "3U": "SICHUAN", "HO": "JUNEYAO", "MF": "XIAMEN", "ZH": "SHENZHEN", "SC": "SHANDONG", "UO": "EXPRESS", "HX": "HONG KONG", "JQ": "JETSTAR", "GK": "JETSTAR", "TR": "SCOOT", "5J": "CEBU", "ZG": "ZIPAIR", "MM": "PEACH", "IT": "TIGERAIR", "D7": "AIRASIA", "AK": "AIRASIA", "BX": "AIR BUSAN", "LJ": "JINAIR", "7C": "JEJU", "TW": "T'WAY", "RS": "AIR SEOUL", "ZE": "EASTAR",
      // Middle East & Africa
      "EK": "EMIRATES", "QR": "QATAR", "EY": "ETIHAD", "SV": "SAUDIA", "RJ": "ROYAL JORDANIAN", "GF": "GULF", "WY": "OMAN", "LY": "EL AL", "SA": "SOUTH AFRICAN", "ET": "ETHIOPIAN", "MS": "EGYPTAIR", "AT": "ROYAL AIR", "KQ": "KENYA", "XY": "FLYNAS",
      // South America & Oceania
      "LA": "LATAM", "CM": "COPA", "AV": "AVIANCA", "AR": "AEROLINEAS ARGENTINAS", "G3": "GOL", "AD": "AZUL", "QF": "QANTAS", "VA": "VIRGIN AUSTRALIA", "NZ": "NEW ZEALAND", "FJ": "FIJI"
    };

    // Helper function to cleanly split "YYYY-MM-DD HH:MM"
    const splitDateTime = (timeStr) => {
      if (!timeStr) return { date: "", time: "" };
      const parts = timeStr.split(' ');
      return { date: parts[0] || "", time: parts[1] || timeStr };
    };

    // Strips away massive JSON bloat to prevent Claude from mixing up data (Token Contamination fix)
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

    const filterAndMinimizeTrunk = (flights) => {
      return (flights || [])
        .map(minimizeFlight)
        .filter(f => {
          if (!f.origin || !allowedOrigins.includes(f.origin)) return false;
          if (!f.dest || !allSearchTargets.includes(f.dest)) return false;
          
          if (trunkFilter) {
            const filterCode = trunkFilter.toUpperCase();
            const filterName = AIRLINE_NAMES[filterCode] || filterCode;
            
            const airlineUpper = f.airline.toUpperCase();
            const flightNumUpper = f.flight_number.toUpperCase();

            // Checks BOTH the translated brand name AND the flight number string
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

    const liveFlights = {
      trunk_flights: filterAndMinimizeTrunk([...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]).slice(0, 40),
      connection_flights: filterAndMinimizeConnections([...(connData.best_flights || []), ...(connData.other_flights || [])]).slice(0, 100)
    };

    console.log(`DEBUG: Found ${liveFlights.trunk_flights.length} strict trunk options.`);

    // CIRCUIT BREAKER: Stop hallucination if no data exists
    if (liveFlights.trunk_flights.length === 0) {
      console.log("CIRCUIT BREAKER: 0 trunk flights found. Aborting Claude to prevent hallucinations.");
      await setDoc(doc(db, "research", userId), {
        results: JSON.stringify({ direct_flights: [], hub_routes: [] }),
        timestamp: new Date().toISOString(),
        status: "complete"
      });
      return; 
    }

    // 5. THE ZERO-TOLERANCE SONNET 4.6 PROMPT
    const nonStandbyAirlines = ["ZIPAIR", "PEACH", "SPRING", "AIRASIA", "CEBU PACIFIC", "SCOOT", "FRONTIER", "SPIRIT", "RYANAIR", "EASYJET"];
    
    // We now pass the perfectly clean, minimized JSON directly
    const enhancedPrompt = prompt + `\n\n
    =========================================
    CLEAN LIVE DATA: ${origin} ➔ ${cleanFinalStr}
    =========================================
    ${JSON.stringify(liveFlights)}
    
    CRITICAL DATA INTEGRITY & EXTRACTION RULES:
    1. ZERO TOLERANCE FOR HALLUCINATIONS: You are strictly forbidden from inventing flights or using pre-trained knowledge. Every single flight number, airline, departure time, and arrival time you output MUST be a direct copy-paste from the CLEAN LIVE DATA provided above.
    2. MANDATORY DIRECT FLIGHTS: Extract and list EVERY direct flight from ${origin} to ${cleanFinalStr} found EXACTLY in the LIVE DATA.
    3. STRICT CONNECTIONS (NO "VARIES"): For hub routes, list each connecting flight individually. NEVER summarize connections.
    4. HUB LIMIT & COVERAGE: Select UP TO 10 hub routes total. Evaluate flights to (${cleanHubStr}). IF A HUB HAS NO TRUNK FLIGHT IN THE LIVE DATA, SKIP IT.
    5. STRICT AIRLINE: ${trunkFilter ? `Leg 1 MUST be on ${trunkFilter}.` : "Use major partners."} Prioritize ${cabin === 'J' ? 'Business/First Class' : 'Economy Class'}.
    6. NON-STANDBY ALERTS: Airlines such as ${nonStandbyAirlines.join(', ')} are NOT standby eligible. If you include them for a highly efficient connection, you MUST add a note: "⚠️ [Airline Name] is not standby eligible (confirmed ticket required)."
    7. JSON ONLY: Return ONLY the structured JSON object.`;

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