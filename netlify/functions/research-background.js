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

    // --- 1. DYNAMIC CONNECTION DATE LOGIC ---
    let connectionDate = date; 
    const longHaulRegions = ['NRT', 'HND', 'ICN', 'TPE', 'HKG', 'LHR', 'FRA', 'CDG', 'AMS', 'SYD', 'AKL', 'SIN', 'PEK', 'PVG'];
    
    const isLongHaul = longHaulRegions.includes(finalDestination.toUpperCase()) || 
                       (hubs && hubs.split(',').some(h => longHaulRegions.includes(h.toUpperCase())));

    if (isLongHaul) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      connectionDate = nextDay.toISOString().split('T')[0];
      console.log(`Long-haul detected. Routing connections for tomorrow: ${connectionDate}`);
    } else {
      console.log(`Short/Medium-haul detected. Routing connections for same-day: ${connectionDate}`);
    }

    const trunkDestinations = hubs ? `${finalDestination},${hubs}` : finalDestination;
    const trunkUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${origin}&arrival_id=${trunkDestinations}&outbound_date=${date}&type=2&api_key=${serpKey}`;
    
    let trunkData = { best_flights: [], other_flights: [] };
    let connData = { best_flights: [], other_flights: [] };

    console.log("Fetching Trunk schedules...");
    
    if (hubs) {
      console.log(`Hubs detected (${hubs}). Fetching Connections...`);
      const connUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${hubs}&arrival_id=${finalDestination}&outbound_date=${connectionDate}&type=2&api_key=${serpKey}`;
      
      const [trunkRes, connRes] = await Promise.all([fetch(trunkUrl), fetch(connUrl)]);
      trunkData = await trunkRes.json();
      connData = await connRes.json();
    } else {
      console.log("No hubs required. Fetching direct/standard routes only.");
      const trunkRes = await fetch(trunkUrl);
      trunkData = await trunkRes.json();
    }

    // --- 2. SMART ASYMMETRIC FILTERING ---
    // Includes both codes and partial names to handle varied SerpApi data formats
    const majorTrunkCarriers = ["UA", "UNITED", "AS", "ALASKA", "HA", "HAWAIIAN", "AA", "AMERICAN", "DL", "DELTA", "JL", "JAPAN AIRLINES", "NH", "ANA", "ALL NIPPON", "ZG", "ZIPAIR", "AF", "AIR FRANCE", "LH", "LUFTHANSA", "BA", "BRITISH AIRWAYS"];

    const liveFlights = {
      trunk_flights: [...(trunkData.best_flights || []), ...(trunkData.other_flights || [])]
        .filter(f => {
          const name = f.airline?.toUpperCase() || "";
          return majorTrunkCarriers.some(carrier => name.includes(carrier));
        })
        .slice(0, 15), 
      connection_flights: [...(connData.best_flights || []), ...(connData.other_flights || [])]
        .slice(0, 40) 
    };

    console.log(`DEBUG: Found ${liveFlights.trunk_flights.length} filtered trunk flights.`);
    console.log(`DEBUG: Found ${liveFlights.connection_flights.length} connection flights.`);

    const compressedFlightData = JSON.stringify(liveFlights).substring(0, 90000);

    console.log("Passing 2-stage live data to Claude (Sonnet 3.5)...");
    
    const enhancedPrompt = prompt + `\n\n
    =========================================
    LIVE FLIGHT DATA: ${origin} ➔ ${finalDestination}
    =========================================
    ${compressedFlightData}
    
    FINAL EXTRACTION INSTRUCTIONS:
    1. SCOPE: Extract all valid flights departing from ${origin} and arriving at ${finalDestination}.
    2. HUB ROUTING: Identify logical routes that pass through these hubs: [${hubs}]. 
    3. CONNECTION FLEXIBILITY: For the connection leg, include ANY airline found in the data.
    4. DATA ROBUSTNESS: Use placeholders (e.g., "Boeing", "2