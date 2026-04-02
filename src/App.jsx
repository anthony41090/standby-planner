import {
  firebaseStorage,
  onAuthChange,
  login,
  signup,
  logout,
  getCurrentUser,
} from "./firebase-storage";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV STANDBY PLANNER v3
// Alaska Airlines ZED/MIBA · Full agreement database · Any origin → Any dest
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Complete Agreement Database ─────────────────────────────────────────────
// J = Business class ZED agreement | Y = Economy only | null = not a partner
const AGREEMENTS = {
  // === HOME AIRLINE — highest standby priority ===
  AS:{j:true,name:"Alaska Airlines",alliance:"oneworld",how:"Home airline",list:"Auto — employee pass",home:true},
  HA:{j:true,name:"Hawaiian Airlines",alliance:"oneworld",how:"Home airline",list:"Auto — employee pass",home:true},
  // === BUSINESS CLASS (J) PARTNERS ===
  AA:{j:true,name:"American Airlines",alliance:"oneworld",how:"See agreement",list:"MyIDTravel"},
  AC:{j:true,name:"Air Canada",alliance:"Star Alliance",how:"See agreement",list:"MyIDTravel"},
  AM:{j:true,name:"Aeromexico",alliance:"SkyTeam",how:"See agreement",list:"MyIDTravel"},
  AY:{j:true,name:"Finnair",alliance:"oneworld",how:"See agreement",list:"MyIDTravel"},
  B0:{j:true,name:"La Compagnie",alliance:null,how:"See agreement",list:"MyIDTravel"},
  B6:{j:true,name:"JetBlue",alliance:null,how:"See agreement",list:"MyIDTravel"},
  BA:{j:true,name:"British Airways",alliance:"oneworld",how:"See agreement",list:"MyIDTravel"},
  BW:{j:true,name:"Caribbean Airlines",alliance:null,how:"See agreement",list:"MyIDTravel"},
  DE:{j:true,name:"Condor",alliance:null,how:"See agreement",list:"MyIDTravel"},
  EY:{j:true,name:"Etihad Airways",alliance:null,how:"See agreement",list:"MyIDTravel"},
  EW:{j:true,name:"Eurowings",alliance:null,how:"See agreement",list:"MyIDTravel"},
  FJ:{j:true,name:"Fiji Airways",alliance:"oneworld connect",how:"MyIDTravel",list:"MyIDTravel"},
  GL:{j:true,name:"Air Greenland",alliance:null,how:"See agreement",list:"MyIDTravel"},
  LH:{j:true,name:"Lufthansa",alliance:"Star Alliance",how:"See agreement",list:"MyIDTravel"},
  LO:{j:true,name:"LOT Polish",alliance:"Star Alliance",how:"See agreement",list:"MyIDTravel"},
  OS:{j:true,name:"Austrian Airlines",alliance:"Star Alliance",how:"See agreement",list:"MyIDTravel"},
  PR:{j:true,name:"Philippine Airlines",alliance:null,how:"See agreement",list:"MyIDTravel"},
  QF:{j:true,name:"Qantas",alliance:"oneworld",how:"See agreement",list:"MyIDTravel"},
  QR:{j:true,name:"Qatar Airways",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  RJ:{j:true,name:"Royal Jordanian",alliance:"oneworld",how:"See agreement",list:"MyIDTravel"},
  UA:{j:true,name:"United Airlines",alliance:"Star Alliance",how:"ID90.com",list:"ID90.com"},
  VA:{j:true,name:"Virgin Australia",alliance:null,how:"See agreement",list:"MyIDTravel"},
  WY:{j:true,name:"Oman Air",alliance:null,how:"See agreement",list:"MyIDTravel"},
  XY:{j:true,name:"Flynas",alliance:null,how:"See agreement",list:"MyIDTravel"},
  MX:{j:true,name:"Breeze Airways",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "4Y":{j:true,name:"Discover Airlines",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "8D":{j:true,name:"FitsAir",alliance:null,how:"See agreement",list:"MyIDTravel"},
  ECA:{j:true,name:"Excellentair",alliance:null,how:"See agreement",list:"MyIDTravel"},
  N0:{j:true,name:"Norse Atlantic Airways",alliance:null,how:"See agreement",list:"MyIDTravel"},
  XE:{j:true,name:"JSX",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "02":{j:true,name:"Vistajet",alliance:null,how:"See agreement",list:"MyIDTravel"},
  // === ECONOMY-ONLY (Y) PARTNERS — major international carriers ===
  AF:{j:false,name:"Air France",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  AI:{j:false,name:"Air India",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  AV:{j:false,name:"Avianca",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  AZ:{j:false,name:"ITA Airways",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  BR:{j:false,name:"EVA Air",alliance:"Star Alliance",how:"MyIDTravel",list:"See agreement"},
  CI:{j:false,name:"China Airlines",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  CM:{j:false,name:"Copa Airlines",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  CX:{j:false,name:"Cathay Pacific",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  DL:{j:false,name:"Delta",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  EK:{j:false,name:"Emirates",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  ET:{j:false,name:"Ethiopian Airlines",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  GA:{j:false,name:"Garuda Indonesia",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  GF:{j:false,name:"Gulf Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  HX:{j:false,name:"Hong Kong Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  IB:{j:false,name:"Iberia",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  IT:{j:false,name:"Tigerair Taiwan",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  JL:{j:false,name:"Japan Airlines",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  JX:{j:false,name:"Starlux Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KE:{j:false,name:"Korean Air",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  KL:{j:false,name:"KLM",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  KU:{j:false,name:"Kuwait Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  LA:{j:false,name:"LATAM Airlines",alliance:null,how:"MyIDTravel",list:"See agreement"},
  MH:{j:false,name:"Malaysia Airlines",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  MU:{j:false,name:"China Eastern",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  NH:{j:false,name:"ANA",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  NZ:{j:false,name:"Air New Zealand",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  OZ:{j:false,name:"Asiana Airlines",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  SA:{j:false,name:"South African Airways",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  SK:{j:false,name:"SAS",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  SN:{j:false,name:"Brussels Airlines",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  SV:{j:false,name:"Saudi Arabian Airlines",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  TG:{j:false,name:"Thai Airways",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  TK:{j:false,name:"Turkish Airlines",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  TN:{j:false,name:"Air Tahiti Nui",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  TP:{j:false,name:"TAP Air Portugal",alliance:"Star Alliance",how:"MyIDTravel",list:"MyIDTravel"},
  UL:{j:false,name:"SriLankan Airlines",alliance:"oneworld",how:"MyIDTravel",list:"MyIDTravel"},
  VN:{j:false,name:"Vietnam Airlines",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  VS:{j:false,name:"Virgin Atlantic",alliance:"SkyTeam",how:"MyIDTravel",list:"MyIDTravel"},
  WS:{j:false,name:"WestJet",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  DY:{j:false,name:"Norwegian",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  FI:{j:false,name:"IcelandAir",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  BF:{j:false,name:"French Bee",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  TS:{j:false,name:"Air Transat",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  UO:{j:false,name:"Hong Kong Express",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  PG:{j:false,name:"Bangkok Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  BI:{j:false,name:"Royal Brunei Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  // === ADDITIONAL ECONOMY PARTNERS (regional, domestic, air taxi) ===
  AN:{j:false,name:"Advanced Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  A3:{j:false,name:"Aegean Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  EI:{j:false,name:"Aer Lingus",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  AR:{j:false,name:"Aerolineas Argentinas",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "6I":{j:false,name:"Air Alsie/Alsie Express",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  G9:{j:false,name:"Air Arabia",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KC:{j:false,name:"Air Astana",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  UU:{j:false,name:"Air Austral",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  BT:{j:false,name:"Air Baltic",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  TY:{j:false,name:"Air Caledonie - Domestic",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  TX:{j:false,name:"Air Caraibes",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "3E":{j:false,name:"Air Choice One",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  XK:{j:false,name:"Air Corsica",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  HF:{j:false,name:"Air Cote d'Ivoire",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  YN:{j:false,name:"Air Creebec",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  EN:{j:false,name:"Air Dolomiti",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  UX:{j:false,name:"Air Europa",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "3H":{j:false,name:"Air Inuit",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  NM:{j:false,name:"Air Moana",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "4N":{j:false,name:"Air North",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  GZ:{j:false,name:"Air Rarotonga",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  HM:{j:false,name:"Air Seychelles",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  VT:{j:false,name:"Air Tahiti",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "8T":{j:false,name:"Air Tindi",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  SB:{j:false,name:"AirCalin International",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  J5:{j:false,name:"Alaska Seaplanes - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  G4:{j:false,name:"Allegiant Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  DM:{j:false,name:"ARAJET",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  IZ:{j:false,name:"Arkia Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "5O":{j:false,name:"ASL Airlines France",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  RC:{j:false,name:"Atlantic Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  XP:{j:false,name:"Avelo Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  AD:{j:false,name:"Azul Linhas Aereas Brasileiras",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  UP:{j:false,name:"Bahamasair",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "8E":{j:false,name:"Bering Air - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  NT:{j:false,name:"Binter Canarias",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "0B":{j:false,name:"Blue Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "13":{j:false,name:"Blue Hawaiian Helicopters",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "4B":{j:false,name:"Boutique Air",alliance:null,how:"See agreement",list:"MyIDTravel"},
  MO:{j:false,name:"Calm Air International",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "5T":{j:false,name:"Canadian North",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "9K":{j:false,name:"Cape Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KX:{j:false,name:"Cayman Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "9M":{j:false,name:"Central Mountain Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  CS:{j:false,name:"Chair Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  LF:{j:false,name:"Contour Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  OU:{j:false,name:"Croatia Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  DN:{j:false,name:"DAN AIR",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  DX:{j:false,name:"Danish Air Transport",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  LY:{j:false,name:"El Al",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  F8:{j:false,name:"Flair Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  FZ:{j:false,name:"Flydubai",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  F9:{j:false,name:"Frontier Airlines Inc.",alliance:null,how:"ID90.com",list:"ID90.com"},
  G3:{j:false,name:"GOL Linhas Aereas",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  YR:{j:false,name:"Grand Canyon Scenic Airlines/Papillon Airways",alliance:null,how:"See agreement",list:"MyIDTravel"},
  GV:{j:false,name:"Grant Aviation - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  YB:{j:false,name:"Harbour Air Seaplanes",alliance:null,how:"See agreement",list:"MyIDTravel"},
  JB:{j:false,name:"HeliJet International Inc.",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "2L":{j:false,name:"Helvetic Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "6E":{j:false,name:"IndiGo",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "6H":{j:false,name:"IsrAir",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  JQ:{j:false,name:"Jetstar Airways Limited",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  GK:{j:false,name:"Jetstar Airways Limited",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  M5:{j:false,name:"Kenmore Air",alliance:null,how:"See agreement",list:"MyIDTravel"},
  KQ:{j:false,name:"Kenya Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KG:{j:false,name:"Key Lime Air/Denver Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KM:{j:false,name:"KM Malta Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  KK:{j:false,name:"LEAV Aviation",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  FC:{j:false,name:"Link Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  LM:{j:false,name:"LoganAir",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  LG:{j:false,name:"Luxair",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  AE:{j:false,name:"Mandarin Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "61":{j:false,name:"Maritime Helicopters",alliance:null,how:"See agreement",list:"MyIDTravel"},
  ME:{j:false,name:"Middle East Airlines - MEA",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  MF:{j:false,name:"Misty Fjords Air - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  Z0:{j:false,name:"Norse Atlantic Airways",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "0N":{j:false,name:"North Star Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "03":{j:false,name:"North Star Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "8P":{j:false,name:"Pacific Coastal Airlines Limited Canada",alliance:null,how:"See agreement",list:"MyIDTravel"},
  PK:{j:false,name:"Pakistan International Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  PB:{j:false,name:"PAL Airlines Canada",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  P6:{j:false,name:"Pascan Aviation",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  JV:{j:false,name:"Perimeter Aviation",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  PD:{j:false,name:"Porter Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  PW:{j:false,name:"Precision Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  AT:{j:false,name:"Royal Air Maroc",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "7S":{j:false,name:"Ryan Air Services - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  S4:{j:false,name:"SATA/Azores Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  BB:{j:false,name:"Seaborne Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  H2:{j:false,name:"SKY Airline",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  QS:{j:false,name:"Smartwings",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "2E":{j:false,name:"Smokey Bay Air - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "9X":{j:false,name:"Southern Airways Express",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  WN:{j:false,name:"Southwest Airlines",alliance:null,how:"See agreement",list:"MyIDTravel"},
  NK:{j:false,name:"Spirit Airlines",alliance:null,how:"ID90.com",list:"ID90.com"},
  VC:{j:false,name:"Sterling Aleutian Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  SY:{j:false,name:"Sun Country Airlines",alliance:null,how:"ID90.com",list:"ID90.com"},
  XQ:{j:false,name:"SunExpress",alliance:null,how:"See agreement",list:"MyIDTravel"},
  LX:{j:false,name:"Swiss",alliance:null,how:"See agreement",list:"MyIDTravel"},
  K3:{j:false,name:"Taquan Air",alliance:null,how:"See agreement",list:"MyIDTravel"},
  TJ:{j:false,name:"Tradewind Aviation",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  HV:{j:false,name:"Transavia Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  TO:{j:false,name:"Transavia France",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "4T":{j:false,name:"Transwest Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "9N":{j:false,name:"Tropic Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  X3:{j:false,name:"TUIfly",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  B7:{j:false,name:"Uni Air",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  VB:{j:false,name:"Viva Aerobus",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  Y4:{j:false,name:"Volaris",alliance:null,how:"ID90.com",list:"ID90.com"},
  V7:{j:false,name:"Volotea",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  VY:{j:false,name:"Vueling Airlines",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "4W":{j:false,name:"Warbelow's Air Ventures",alliance:null,how:"See agreement",list:"MyIDTravel"},
  WP:{j:false,name:"Wasaya Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  WF:{j:false,name:"Wideroe",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  WM:{j:false,name:"WinAir (Windward Island Airways)",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  P5:{j:false,name:"WINGO",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},
  "28":{j:false,name:"Wings Airways JNU - Air Taxi",alliance:null,how:"See agreement",list:"MyIDTravel"},
  "8V":{j:false,name:"Wright Air Service",alliance:null,how:"See agreement",list:"MyIDTravel"},
  IY:{j:false,name:"Yemen Airways",alliance:null,how:"MyIDTravel",list:"MyIDTravel"},

};

const J_PARTNERS = Object.entries(AGREEMENTS).filter(([,v])=>v.j).map(([k])=>k);
const Y_PARTNERS = Object.keys(AGREEMENTS);

// ─── Detailed Airline Rules (expanded set) ───────────────────────────────────
const AIRLINE_RULES = {
  AS:{name:"Alaska Airlines",listingLabel:"★ Home airline — auto-listed",listingAlert:"green",
    listingFull:"Home airline employee pass. Auto-listed. Highest standby priority of all options. List via Alaska employee portal. No ZED ticket needed.",
    checkIn:"Alaska app, alaskaair.com, or kiosk. Check in up to 24 hrs before departure.",checkInApp:"Alaska Airlines App",
    dress:"Neat, clean, presentable. No ripped/torn clothing. Standard employee non-rev dress code.",
    warning:"Home airline = best standby priority. Always try AS/HA routes first before ZED partners.",
    exclusions:"None — full network access as employee."},
  HA:{name:"Hawaiian Airlines",listingLabel:"★ Home airline — auto-listed",listingAlert:"green",
    listingFull:"Home airline employee pass (Alaska/Hawaiian merged). Auto-listed. Highest standby priority. Flies to NRT, HND, KIX, ICN, SYD, AKL, PPT and extensive Pacific network.",
    checkIn:"Hawaiian Airlines app or hawaiianairlines.com. Check in up to 24 hrs before departure.",checkInApp:"Hawaiian Airlines App",
    dress:"Neat, clean, presentable. Standard employee non-rev dress code.",
    warning:"Home airline = best standby priority. HA has wide-body service to Japan (NRT/HND/KIX), Korea (ICN), Australia (SYD), New Zealand (AKL), and Tahiti (PPT) — all with J class on employee pass.",
    exclusions:"None — full network access as employee."},
  UA:{name:"United Airlines",listingLabel:"List at ticket purchase (ID90Travel)",listingAlert:"green",
    listingFull:"Listing auto-created at ID90Travel purchase. Buy ≥48 hrs before dep. Changes: call ePass +1-866-359-3727.",
    checkIn:"United app/united.com/kiosk up to 24 hrs before. Seats auto-cleared ~1 hr before intl dep.",checkInApp:"United App",
    dress:"Relaxed — clean jeans/leggings OK. No midriff, holes, beach flip-flops.",
    warning:"J clearance not guaranteed — UA uses SPA auto-clear. Download United app.",
    exclusions:"Star Alliance codeshares; ferry/positioning flights."},
  JL:{name:"Japan Airlines",listingLabel:"⚠ List 24 hrs before — MANDATORY",listingAlert:"red",
    listingFull:"MANDATORY for ALL JL intl flights. Must list via myIDTravel ≥24 hrs before dep — no exceptions.",
    checkIn:"3 hrs before dep. Gate: 40 min before.",checkInApp:null,
    dress:"Smart casual — neat, clean, conservative.",
    warning:"No oneworld benefits. No lounge, meals, upgrades, seat selection.",
    exclusions:"All codeshares not operated by JL."},
  NH:{name:"ANA",listingLabel:"Via myIDTravel at purchase",listingAlert:"green",
    listingFull:"Booking via myIDTravel. Intl window opens 90 days out. RBD X for economy (May 2026+).",
    checkIn:"ANA app / ana.co.jp.",checkInApp:"ANA App",
    dress:"Business casual. No torn jeans, shorts, flip-flops, tank tops.",
    warning:"Codeshares excluded. Only NH/NQ/EH operated flights.",
    exclusions:"All codeshares operated by other carriers."},
  KE:{name:"Korean Air",listingLabel:"Via myIDTravel — list in advance",listingAlert:"green",
    listingFull:"List via myIDTravel as far in advance as possible.",
    checkIn:"Report to KE standby counter at airport with ticket and ITR.",checkInApp:null,
    dress:"Smart casual.",
    warning:"Must physically report to KE counter. KE3001–3999, KE5000–7999 excluded.",
    exclusions:"Codeshares KE3001–3999, KE5000–7999, KE1401–1440."},
  OZ:{name:"Asiana Airlines",listingLabel:"⚠ List 24 hrs before — MANDATORY",listingAlert:"red",
    listingFull:"MANDATORY — no listing = denied check-in. Auto-listed at myIDTravel purchase.",
    checkIn:"Varies by airport — check flyasiana.com.",checkInApp:null,
    dress:"Smart casual STRICTLY enforced. NO jeans, T-shirts, shorts, gym shoes.",
    warning:"No listing = denied. Dress code strictly enforced.",
    exclusions:"All codeshares not operated by Asiana."},
  BR:{name:"EVA Air",listingLabel:"List 6 hrs before dep",listingAlert:"amber",
    listingFull:"List ≥6 hrs before dep. Auto-listed if ticket stock starts with 695.",
    checkIn:"EVA app (3 hrs to 60–80 min before). Present 1 hr before at counter.",checkInApp:"EVA Air App",
    dress:"Smart casual — office-appropriate.",
    warning:"No upgrades, special meals, or seat requests.",
    exclusions:"Codeshares not operated by EVA."},
  CI:{name:"China Airlines",listingLabel:"List 6 hrs before · RBD X",listingAlert:"amber",
    listingFull:"List ≥6 hrs before via myIDTravel or CI reservations. RBD X required.",
    checkIn:"⚠ Counter stops 20 min before counter close — arrive early.",checkInApp:null,
    dress:"Smart casual strictly enforced.",
    warning:"Check-in closes 20 min early. No through check-in.",
    exclusions:"All codeshares not operated by CI."},
  MU:{name:"China Eastern",listingLabel:"Auto-listed at purchase (ZED Low)",listingAlert:"green",
    listingFull:"Auto-listed at myIDTravel purchase. ZED Low fare. No name/routing changes.",
    checkIn:"Standard airport check-in.",checkInApp:null,dress:"Smart casual.",
    warning:"No name/routing changes. Do NOT dispute CC charge.",exclusions:"Verify via myIDTravel."},
  JX:{name:"Starlux Airlines",listingLabel:"Auto-listed at purchase (ZED Medium)",listingAlert:"green",
    listingFull:"Auto-listed at myIDTravel purchase. ZED Medium fare (higher cost).",
    checkIn:"Online: 48 hrs to 1 hr before. Counter: 3 hrs to 1 hr before.",checkInApp:"Starlux app",
    dress:"Smart casual.",warning:"ZED Medium = higher ticket cost.",exclusions:"Verify via myIDTravel."},
  IT:{name:"Tigerair Taiwan",listingLabel:"Auto-listed at purchase (ZED Low)",listingAlert:"green",
    listingFull:"Auto-listed at myIDTravel purchase. ZED Low fare.",
    checkIn:"Counter: 3 hrs to 40 min before. Online: 24 hrs to 60 min before.",checkInApp:null,
    dress:"Smart casual.",warning:"No name/routing changes.",exclusions:"Verify via myIDTravel."},
  QR:{name:"Qatar Airways",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Oneworld partner. DOH is a mega-hub.",
    checkIn:"Qatar Airways app or qatarairways.com.",checkInApp:"Qatar Airways App",
    dress:"Smart casual.",warning:"DOH hub excellent for connections. Check flyzed.info/QR.",exclusions:"Check flyzed.info."},
  BA:{name:"British Airways",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Oneworld partner.",
    checkIn:"British Airways app. T5 at LHR.",checkInApp:"British Airways App",
    dress:"Smart casual for J cabin.",warning:"LHR T5 well-organized. Check flyzed.info/BA.",exclusions:"Check flyzed.info."},
  AA:{name:"American Airlines",listingLabel:"See agreement",listingAlert:"amber",
    listingFull:"See the agreement document. Oneworld partner.",
    checkIn:"American Airlines app or aa.com.",checkInApp:"American Airlines App",
    dress:"Business casual for J cabin.",warning:"Check specific agreement terms.",exclusions:"Check agreement."},
  EY:{name:"Etihad Airways",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Non-alliance ZED partner.",
    checkIn:"Etihad app.",checkInApp:"Etihad App",
    dress:"Smart casual.",warning:"Non-alliance — verify current agreement status. Check regional stability.",exclusions:"Check myIDTravel."},
  LH:{name:"Lufthansa",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Star Alliance partner.",
    checkIn:"Lufthansa app.",checkInApp:"Lufthansa App",
    dress:"Business casual for J cabin.",warning:"FRA mega-hub. Check flyzed.info/LH.",exclusions:"Check flyzed.info."},
  AY:{name:"Finnair",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Oneworld partner. HEL is shortest Europe→Asia routing.",
    checkIn:"Finnair app.",checkInApp:"Finnair App",
    dress:"Smart casual.",warning:"HEL compact hub — fast connections. Check flyzed.info/AY.",exclusions:"Check flyzed.info."},
  AC:{name:"Air Canada",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Star Alliance partner.",
    checkIn:"Air Canada app.",checkInApp:"Air Canada App",
    dress:"Business casual.",warning:"YVR good Pacific gateway. Check flyzed.info/AC.",exclusions:"Check flyzed.info."},
  TK:{name:"Turkish Airlines",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Star Alliance. IST is a mega-hub.",
    checkIn:"Turkish Airlines app.",checkInApp:"Turkish Airlines App",
    dress:"Smart casual.",warning:"IST mega-hub — connects everywhere. Check flyzed.info/TK.",exclusions:"Check flyzed.info."},
  EK:{name:"Emirates",listingLabel:"Via myIDTravel",listingAlert:"amber",
    listingFull:"Book via myIDTravel. Strict rules.",
    checkIn:"Emirates app.",checkInApp:"Emirates App",
    dress:"Smart casual strictly enforced.",warning:"Very strict dress code. Check flyzed.info/EK.",exclusions:"Check flyzed.info."},
  CX:{name:"Cathay Pacific",listingLabel:"Via myIDTravel",listingAlert:"green",
    listingFull:"Book via myIDTravel. Oneworld partner.",
    checkIn:"Cathay Pacific app.",checkInApp:"Cathay Pacific App",
    dress:"Smart casual.",warning:"HKG excellent hub. Check flyzed.info/CX.",exclusions:"Check flyzed.info."},
};

// ─── Airport & Hub Knowledge ─────────────────────────────────────────────────
const REGIONS = {
  "East Asia":{
    destinations:["NRT","HND","ICN","PVG","PEK","HKG","TPE","KIX","FUK","CTS","NGO","OKA"],
    keywords:["japan","tokyo","osaka","kyoto","korea","seoul","china","shanghai","beijing","hong kong","taiwan","taipei"],
    jTrunkCarriers:["AS","HA","UA","AA","BA","QR","EY","QF","LH","AY","AC","PR"],
    econConnectors:["JL","NH","KE","OZ","CX","BR","CI","MU","JX","IT","TG","MH","VN","HX","UO"],
    // Explicit routing hubs: UA flies from US gateways to these airports.
    // From each hub, list the economy partner airlines that connect onward to the region.
    routingHubs:[
      {code:"NRT",name:"Tokyo Narita",uaDirect:true,note:"UA direct from SFO/LAX/IAD/EWR/ORD/IAH/DEN. Also AS seasonal.",connPartners:[]},
      {code:"HND",name:"Tokyo Haneda",uaDirect:true,note:"UA direct from SFO/LAX/EWR/ORD/IAH. Closer to city than NRT.",connPartners:[]},
      {code:"KIX",name:"Osaka Kansai",uaDirect:true,note:"UA direct from SFO (seasonal). HA from HNL.",connPartners:[]},
      {code:"ICN",name:"Seoul Incheon",uaDirect:true,note:"UA direct from SFO/LAX/EWR/ORD/IAH. Connect to KE/OZ onward to Japan/Asia.",connPartners:["KE","OZ"]},
      {code:"TPE",name:"Taipei Taoyuan",uaDirect:true,note:"UA direct from SFO/LAX. ⚠ TSA (Songshan) is separate airport. Connect to BR/CI/JX/IT to Japan.",connPartners:["BR","CI","JX","IT","JL"]},
      {code:"PVG",name:"Shanghai Pudong",uaDirect:true,note:"UA direct from SFO/LAX/EWR/ORD/IAH. Overnight needed. Connect MU/NH/JL to Japan.",connPartners:["MU","NH","JL"]},
      {code:"HKG",name:"Hong Kong",uaDirect:true,note:"UA direct from SFO/LAX/EWR. Connect CX/HX to regional.",connPartners:["CX","HX","UO"]},
      {code:"MNL",name:"Manila",uaDirect:true,note:"UA direct from SFO/LAX. PR (J class!) from MNL to NRT/HND.",connPartners:["PR","JL","NH"]},
      {code:"HNL",name:"Honolulu",uaDirect:false,note:"HOME airline hub. AS/UA from US → HA/UA/JL/NH/WN onward to NRT/HND/KIX/ICN. Search ALL partners from HNL.",connPartners:["HA","UA","JL","NH","KE","OZ","WN"],isHome:true},
      {code:"DOH",name:"Doha",uaDirect:false,note:"QR (J class) from US → QR onward to NRT/HND/KIX/ICN/HKG/BKK/SIN etc.",connPartners:["QR"]},
      {code:"HEL",name:"Helsinki",uaDirect:false,note:"AY (J class) from US → AY onward to NRT/HND. Shortest Europe-Asia routing.",connPartners:["AY"]},
      {code:"LHR",name:"London Heathrow",uaDirect:false,note:"BA (J class) from US → BA/JL onward to NRT/HND.",connPartners:["BA","JL"]},
      {code:"FRA",name:"Frankfurt",uaDirect:false,note:"LH (J class) from US → LH/NH onward to NRT/HND.",connPartners:["LH","NH"]},
      {code:"YVR",name:"Vancouver",uaDirect:false,note:"AC (J class) from US → AC onward to NRT/HND. Good Pacific routing.",connPartners:["AC"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA to NRT/HND/KIX; HA to NRT/HND/KIX from HNL; AS to NRT (seasonal) — HOME airline = highest priority"},
      {hub:"HNL",carrier:"AS→HA",note:"AS from US cities to HNL, then HA J class onward to NRT/HND/KIX/ICN — both HOME airline!"},
      {hub:"ICN",carrier:"UA→KE/OZ",note:"UA to Seoul, then Korean Air or Asiana economy to Japan (2-3h flights, frequent)"},
      {hub:"TPE",carrier:"UA→BR/CI/JX/IT",note:"UA to Taipei, then EVA/China Airlines/Starlux/Tigerair to Japan. ⚠ TSA≠TPE warning"},
      {hub:"PVG",carrier:"UA→MU/NH/JL",note:"UA to Shanghai, overnight required, then China Eastern/ANA/JAL to Japan"},
      {hub:"DOH",carrier:"QR",note:"Qatar J class both legs via Doha — premium but long routing"},
      {hub:"HEL",carrier:"AY",note:"Finnair J class via Helsinki — shortest Europe-Asia path"},
      {hub:"LHR",carrier:"BA",note:"British Airways J class via London — oneworld connections"},
      {hub:"FRA",carrier:"LH",note:"Lufthansa J class via Frankfurt — Star Alliance"},
      {hub:"MNL",carrier:"UA/PR",note:"Philippine Airlines J class from Manila to NRT/HND"},
      {hub:"YVR",carrier:"AC",note:"Air Canada J class via Vancouver"},
    ],
  },
  "Southeast Asia":{
    destinations:["SIN","BKK","MNL","SGN","HAN","KUL","CGK","DPS","RGN","PNH","REP","CEB"],
    keywords:["singapore","thailand","bangkok","bali","vietnam","hanoi","manila","philippines","indonesia","malaysia","kuala lumpur","cambodia","myanmar"],
    jTrunkCarriers:["AS","HA","UA","AA","BA","QR","EY","QF","LH","AY","PR"],
    econConnectors:["SQ","TG","CX","MH","GA","VN","BR","CI","KE","OZ","JL","NH","PG","BI","UL"],
    routingHubs:[
      {code:"SIN",name:"Singapore Changi",uaDirect:true,note:"UA direct from SFO/LAX/EWR. Final destination or connect SQ/TG/MH/GA/VN onward.",connPartners:["SQ","TG","MH","GA","VN"]},
      {code:"MNL",name:"Manila",uaDirect:true,note:"UA direct from SFO/LAX. PR (J class!) onward to SE Asia cities. HA from HNL.",connPartners:["PR","CX"]},
      {code:"NRT",name:"Tokyo Narita",uaDirect:true,note:"UA from many US gateways. Connect JL/NH/CX/TG/SQ/VN economy onward to SE Asia.",connPartners:["JL","NH","CX","TG","SQ","VN"]},
      {code:"HND",name:"Tokyo Haneda",uaDirect:true,note:"UA from SFO/LAX/EWR/ORD/IAH. Connect JL/NH/TG economy to BKK/SIN/SGN etc.",connPartners:["JL","NH","TG","VN"]},
      {code:"ICN",name:"Seoul Incheon",uaDirect:true,note:"UA from SFO/LAX/EWR/ORD/IAH. Connect KE/OZ economy to BKK/SIN/SGN/MNL/CGK.",connPartners:["KE","OZ"]},
      {code:"TPE",name:"Taipei Taoyuan",uaDirect:true,note:"UA from SFO/LAX. Connect BR/CI economy to BKK/SIN/MNL/SGN/KUL. ⚠ TSA≠TPE.",connPartners:["BR","CI"]},
      {code:"HKG",name:"Hong Kong",uaDirect:true,note:"UA from SFO/LAX/EWR. CX economy hub — massive SE Asia network from HKG.",connPartners:["CX","HX","UO"]},
      {code:"PVG",name:"Shanghai Pudong",uaDirect:true,note:"UA from SFO/LAX/EWR/ORD/IAH. Overnight. MU economy connections to SE Asia.",connPartners:["MU"]},
      {code:"HNL",name:"Honolulu",uaDirect:false,note:"HOME airline hub. AS/UA from US → HA/UA and partners from HNL.",connPartners:["HA","UA","PR"],isHome:true},
      {code:"DOH",name:"Doha",uaDirect:false,note:"QR (J class) excellent connections to BKK/SIN/KUL/CGK/DPS/SGN/HAN/MNL.",connPartners:["QR"]},
      {code:"AUH",name:"Abu Dhabi",uaDirect:false,note:"EY (J class) connects to BKK/SIN/KUL/CGK. Check regional stability.",connPartners:["EY"]},
      {code:"LHR",name:"London Heathrow",uaDirect:false,note:"BA (J class) from US → BA/CX/MH/TG/SQ economy onward to SE Asia.",connPartners:["BA","CX","MH","TG","SQ"]},
      {code:"HEL",name:"Helsinki",uaDirect:false,note:"AY (J class) from US → AY economy to BKK/SIN/HKG. Short routing.",connPartners:["AY"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA to SIN/MNL; PR J class to MNL from US gateways"},
      {hub:"NRT/HND",carrier:"UA→JL/NH/CX/TG",note:"Tokyo hub — excellent economy connections to all SE Asia"},
      {hub:"ICN",carrier:"UA→KE/OZ",note:"Seoul — KE/OZ fly to all major SE Asia cities (economy)"},
      {hub:"HKG",carrier:"UA→CX",note:"Cathay Pacific economy mega-hub for SE Asia from HKG"},
      {hub:"TPE",carrier:"UA→BR/CI",note:"EVA/China Airlines economy to BKK/SIN/MNL/SGN/KUL"},
      {hub:"DOH",carrier:"QR",note:"Qatar J class both legs — BKK/SIN/KUL/CGK/DPS all served"},
      {hub:"HEL",carrier:"AY",note:"Finnair J class via Helsinki — BKK/SIN direct"},
    ],
  },
  "Europe":{
    destinations:["LHR","CDG","FCO","BCN","AMS","FRA","MUC","ZRH","VIE","WAW","IST","ATH","LIS","CPH","ARN","OSL","HEL","DUB","EDI","PRG"],
    keywords:["london","paris","rome","barcelona","amsterdam","frankfurt","munich","zurich","vienna","istanbul","athens","lisbon","dublin","copenhagen","europe","italy","france","germany","spain","portugal","greece","turkey","uk","ireland","scotland","prague","poland","warsaw"],
    jTrunkCarriers:["UA","AA","BA","LH","OS","AY","LO","AC","EY","QR","B0","DE"],
    econConnectors:["AF","KL","IB","SK","SN","TP","AZ","TK","VS","DY","FI","EW","DL"],
    routingHubs:[
      {code:"LHR",name:"London Heathrow",uaDirect:true,note:"UA from SFO/LAX/EWR/IAD/ORD/IAH/DEN/BOS. Also BA (J!) and AA (J!) direct. Massive intra-Europe connections.",connPartners:["BA","AA","IB","EI","VS","AF","KL"]},
      {code:"FRA",name:"Frankfurt",uaDirect:true,note:"UA from SFO/LAX/EWR/IAD/ORD/IAH/DEN. Also LH (J!) direct. Star Alliance mega-hub.",connPartners:["LH","LX","OS","SK","SN","TP","AZ"]},
      {code:"MUC",name:"Munich",uaDirect:true,note:"UA from SFO/EWR/IAD/ORD. Also LH (J!) direct. Efficient Star Alliance hub.",connPartners:["LH","OS","SK"]},
      {code:"CDG",name:"Paris CDG",uaDirect:true,note:"UA from SFO/EWR/IAD. Also AA (J!) direct. AF/KL economy hub.",connPartners:["AF","KL","DL"]},
      {code:"AMS",name:"Amsterdam Schiphol",uaDirect:true,note:"UA from SFO/IAD/IAH. KL economy mega-hub for all Europe.",connPartners:["KL","DL"]},
      {code:"ZRH",name:"Zurich",uaDirect:true,note:"UA from SFO/EWR. LX (J!) direct. Compact Swiss hub.",connPartners:["LX","EW"]},
      {code:"FCO",name:"Rome Fiumicino",uaDirect:true,note:"UA from EWR/IAD. Also AA (J!) direct.",connPartners:["AZ","IB"]},
      {code:"BCN",name:"Barcelona",uaDirect:true,note:"UA from EWR (seasonal). Also AA direct.",connPartners:["IB","VY"]},
      {code:"DUB",name:"Dublin",uaDirect:true,note:"UA from EWR/IAD/ORD. Also AA/EI direct.",connPartners:["EI"]},
      {code:"LIS",name:"Lisbon",uaDirect:true,note:"UA from EWR. TP economy hub for Southern Europe + Africa.",connPartners:["TP"]},
      {code:"ATH",name:"Athens",uaDirect:true,note:"UA from EWR (seasonal). Connect to Greek islands.",connPartners:["A3"]},
      {code:"EDI",name:"Edinburgh",uaDirect:true,note:"UA from EWR (seasonal).",connPartners:[]},
      {code:"IST",name:"Istanbul",uaDirect:true,note:"UA from IAD/EWR. TK economy mega-hub — connects to everywhere in Europe, ME, Africa, Asia.",connPartners:["TK"]},
      {code:"VIE",name:"Vienna",uaDirect:false,note:"OS (J class) from US gateways. Star Alliance hub — good Central/Eastern Europe.",connPartners:["OS","LO"]},
      {code:"HEL",name:"Helsinki",uaDirect:false,note:"AY (J class) from US gateways. Good Nordic + Baltics connections.",connPartners:["AY","SK","FI"]},
      {code:"WAW",name:"Warsaw",uaDirect:false,note:"LO (J class) from ORD/EWR/JFK. Central/Eastern Europe hub.",connPartners:["LO"]},
      {code:"DOH",name:"Doha",uaDirect:false,note:"QR (J class) from US → QR economy to many European cities. Long routing.",connPartners:["QR"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA/AA/BA/LH fly direct from most US gateways to major European cities"},
      {hub:"LHR",carrier:"BA/AA/UA",note:"London mega-hub — BA (J class) intra-Europe network is enormous"},
      {hub:"FRA",carrier:"LH/UA",note:"Lufthansa (J class) Frankfurt — Star Alliance hub, all of Europe"},
      {hub:"MUC",carrier:"LH/UA",note:"Munich — efficient alternative to FRA, fewer crowds"},
      {hub:"AMS",carrier:"KL",note:"KLM economy hub — great coverage of smaller European cities"},
      {hub:"IST",carrier:"TK",note:"Turkish economy mega-hub — connects everywhere including off-the-beaten-path"},
      {hub:"VIE",carrier:"OS",note:"Austrian (J class) — best for Central/Eastern Europe"},
      {hub:"HEL",carrier:"AY",note:"Finnair (J class) — Nordics, Baltics"},
    ],
  },
  "Middle East":{
    destinations:["DXB","AUH","DOH","AMM","RUH","JED","BAH","MCT","TLV","BEY","CAI"],
    keywords:["dubai","abu dhabi","doha","qatar","jordan","amman","saudi","riyadh","jeddah","bahrain","oman","muscat","israel","tel aviv","cairo","egypt","lebanon","beirut","middle east"],
    jTrunkCarriers:["UA","EY","QR","AA","BA","LH","RJ","WY"],
    econConnectors:["EK","TK","GF","KU","SV","ME","RJ","AI"],
    routingHubs:[
      {code:"DOH",name:"Doha Hamad",uaDirect:false,note:"QR (J class) from JFK/IAD/IAH/ORD/LAX/DFW/MIA. Mega-hub for all Middle East.",connPartners:["QR"]},
      {code:"AUH",name:"Abu Dhabi",uaDirect:false,note:"EY (J class) from JFK/IAD/ORD/LAX. Gateway to UAE + Gulf.",connPartners:["EY"]},
      {code:"DXB",name:"Dubai",uaDirect:false,note:"EK (economy) from JFK/IAD/LAX/SFO/IAH/DFW/BOS/ORD/SEA. Massive ME hub.",connPartners:["EK"]},
      {code:"IST",name:"Istanbul",uaDirect:true,note:"UA from IAD/EWR. TK economy mega-hub — connects to ALL ME cities, AMM/CAI/BEY/TLV/RUH/JED etc.",connPartners:["TK"]},
      {code:"LHR",name:"London Heathrow",uaDirect:true,note:"UA/AA/BA (J class) from many US cities. BA economy to DXB/AUH/DOH/AMM/TLV/CAI etc.",connPartners:["BA","RJ","EK","EY","QR"]},
      {code:"FRA",name:"Frankfurt",uaDirect:true,note:"UA/LH from many US cities. LH economy to TLV/CAI/AMM/BEY/DXB etc.",connPartners:["LH","EK"]},
      {code:"AMM",name:"Amman",uaDirect:false,note:"RJ (J class) from ORD/JFK/DFW. Royal Jordanian hub — AMM gateway to Levant.",connPartners:["RJ"]},
      {code:"TLV",name:"Tel Aviv",uaDirect:true,note:"UA from EWR (direct). Also connect via IST/LHR/FRA.",connPartners:[]},
      {code:"CAI",name:"Cairo",uaDirect:false,note:"Connect via IST (TK), DOH (QR), or LHR (BA). No US nonstop.",connPartners:["TK","QR","BA"]},
    ],
    hubStrategy:[
      {hub:"DOH",carrier:"QR",note:"Qatar J class — best hub for the entire Gulf/ME region"},
      {hub:"AUH",carrier:"EY",note:"Etihad J class — UAE base, good Gulf connections"},
      {hub:"IST",carrier:"UA/TK",note:"UA direct to IST, then TK economy to every ME city"},
      {hub:"LHR",carrier:"BA",note:"BA J class from US → BA economy to ME"},
      {hub:"DXB",carrier:"EK",note:"Emirates economy — massive ME hub (no J agreement)"},
      {hub:"AMM",carrier:"RJ",note:"Royal Jordanian J class — direct from US"},
    ],
  },
  "South Asia":{
    destinations:["DEL","BOM","MAA","BLR","CCU","CMB","DAC","KTM","ISB","LHE","KHI"],
    keywords:["india","delhi","mumbai","bangalore","chennai","kolkata","sri lanka","colombo","nepal","kathmandu","pakistan","bangladesh","south asia"],
    jTrunkCarriers:["UA","BA","QR","EY","LH","AY","AC"],
    econConnectors:["AI","UL","TK","EK","SV","KU","GF"],
    routingHubs:[
      {code:"DEL",name:"Delhi Indira Gandhi",uaDirect:true,note:"UA from EWR/SFO (direct). Also AI economy from US gateways.",connPartners:["AI"]},
      {code:"BOM",name:"Mumbai",uaDirect:true,note:"UA from EWR (direct). Also AI economy.",connPartners:["AI"]},
      {code:"DOH",name:"Doha Hamad",uaDirect:false,note:"QR (J class) from many US cities. QR connects to DEL/BOM/MAA/BLR/CCU/CMB/KTM/ISB/LHE/KHI/DAC.",connPartners:["QR"]},
      {code:"AUH",name:"Abu Dhabi",uaDirect:false,note:"EY (J class) from JFK/IAD/ORD/LAX. EY connects to DEL/BOM/MAA/BLR/CMB/ISB/LHE/KHI.",connPartners:["EY"]},
      {code:"DXB",name:"Dubai",uaDirect:false,note:"EK (economy) from many US cities. EK massive India/Pakistan/SL network from DXB.",connPartners:["EK"]},
      {code:"IST",name:"Istanbul",uaDirect:true,note:"UA from IAD/EWR. TK economy to DEL/BOM/MAA/BLR/CCU/CMB/ISB/LHE/KHI/DAC/KTM.",connPartners:["TK"]},
      {code:"LHR",name:"London Heathrow",uaDirect:true,note:"UA/AA/BA (J class) from many US cities. BA economy to DEL/BOM/MAA/BLR/CMB/ISB. Also AI economy.",connPartners:["BA","AI"]},
      {code:"FRA",name:"Frankfurt",uaDirect:true,note:"UA/LH from US. LH economy to DEL/BOM/BLR/MAA.",connPartners:["LH","AI"]},
      {code:"HEL",name:"Helsinki",uaDirect:false,note:"AY (J class) from US → AY to DEL (seasonal). Short routing.",connPartners:["AY"]},
      {code:"YYZ",name:"Toronto",uaDirect:false,note:"AC (J class) from US → AC to DEL/BOM. Good routing from eastern US.",connPartners:["AC"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA direct DEL (EWR/SFO) and BOM (EWR)"},
      {hub:"DOH",carrier:"QR",note:"Qatar J class — best coverage of entire South Asia, all major cities"},
      {hub:"AUH",carrier:"EY",note:"Etihad J class — strong India/Pakistan network"},
      {hub:"IST",carrier:"UA/TK",note:"UA to IST, then TK economy to all S Asia cities"},
      {hub:"LHR",carrier:"BA",note:"BA J class from US → BA economy with extensive India network"},
      {hub:"DXB",carrier:"EK",note:"Emirates economy — massive S Asia hub (no J agreement)"},
      {hub:"FRA",carrier:"LH",note:"Lufthansa J class → LH economy to DEL/BOM/BLR"},
    ],
  },
  "Oceania":{
    destinations:["SYD","MEL","BNE","AKL","CHC","NAN","PPT"],
    keywords:["australia","sydney","melbourne","brisbane","new zealand","auckland","fiji","tahiti","oceania","pacific"],
    jTrunkCarriers:["HA","UA","QF","AA","FJ","VA"],
    econConnectors:["NZ","CX","JL","NH","KE","TN","SQ"],
    routingHubs:[
      {code:"SYD",name:"Sydney",uaDirect:true,note:"UA from SFO/LAX/IAH. Also QF (J class!) from LAX/DFW. HA from HNL. VA (J class) from LAX.",connPartners:["QF","VA","NZ"]},
      {code:"MEL",name:"Melbourne",uaDirect:true,note:"UA from SFO/LAX (seasonal). QF (J class) from LAX. Connect from SYD on QF/VA.",connPartners:["QF","VA"]},
      {code:"AKL",name:"Auckland",uaDirect:true,note:"UA from SFO. HA from HNL. NZ (economy) from LAX/SFO/IAH/ORD.",connPartners:["NZ"]},
      {code:"NAN",name:"Nadi Fiji",uaDirect:false,note:"FJ (J class!) from LAX direct. Connect FJ onward to SYD/AKL/PPT.",connPartners:["FJ"]},
      {code:"PPT",name:"Papeete Tahiti",uaDirect:false,note:"HA from HNL (home airline J!). Also TN/BF from CDG or connect via NAN on FJ.",connPartners:["HA","TN","FJ"]},
      {code:"HNL",name:"Honolulu",uaDirect:false,note:"HOME airline hub. AS/UA from US → HA/UA/FJ onward to SYD/AKL/PPT/NAN.",connPartners:["HA","UA","FJ","NZ"],isHome:true},
      {code:"NRT",name:"Tokyo Narita",uaDirect:false,note:"UA from US → JL/NH/QF economy onward to SYD/MEL/AKL. Long routing but viable backup.",connPartners:["JL","NH","QF"]},
      {code:"SIN",name:"Singapore",uaDirect:false,note:"UA from SFO/LAX/EWR → SQ economy to SYD/MEL/BNE/AKL. Long routing.",connPartners:["SQ"]},
      {code:"DOH",name:"Doha",uaDirect:false,note:"QR (J class) from US → QR to MEL/SYD/AKL. Ultra-long but J both legs possible.",connPartners:["QR"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA to SYD/MEL/AKL; QF J to SYD/MEL from LAX; HA J to SYD/AKL/PPT from HNL"},
      {hub:"HNL",carrier:"AS→HA",note:"AS to Honolulu, then HA J class onward — HOME airline, best priority!"},
      {hub:"NAN",carrier:"FJ",note:"Fiji Airways J class from LAX — connect to SYD/AKL/PPT"},
      {hub:"NRT",carrier:"UA→JL/NH",note:"Tokyo connection — long routing but lots of backup flights"},
      {hub:"DOH",carrier:"QR",note:"Qatar J class both legs — ultra-long but premium"},
    ],
  },
  "South America":{
    destinations:["GRU","EZE","SCL","LIM","BOG","GIG","PTY","UIO","MVD","CCS"],
    keywords:["brazil","argentina","chile","peru","colombia","bogota","buenos aires","santiago","lima","south america","latin america","panama","ecuador"],
    jTrunkCarriers:["UA","AA","AC","AM"],
    econConnectors:["LA","AV","CM","DL","CX","EK","TK","AF"],
    routingHubs:[
      {code:"GRU",name:"São Paulo Guarulhos",uaDirect:true,note:"UA from IAH/EWR. AA from MIA/DFW/JFK. Also LA/AV economy from US.",connPartners:["LA","AV","AF"]},
      {code:"EZE",name:"Buenos Aires Ezeiza",uaDirect:true,note:"UA from IAH/EWR. AA from MIA/DFW. Final destination or connect to MVD/SCL.",connPartners:["LA","AA"]},
      {code:"SCL",name:"Santiago",uaDirect:true,note:"UA from IAH. AA from MIA/DFW. LA economy from US. Final destination or connect to regional.",connPartners:["LA"]},
      {code:"LIM",name:"Lima",uaDirect:true,note:"UA from IAH/EWR. AA from MIA/DFW. LA economy hub for western S America.",connPartners:["LA","AV"]},
      {code:"BOG",name:"Bogotá",uaDirect:true,note:"UA from IAH/EWR. AA from MIA/DFW. AV economy mega-hub for S America.",connPartners:["AV","LA","CM"]},
      {code:"PTY",name:"Panama City Tocumen",uaDirect:true,note:"UA from IAH/EWR. CM economy mega-hub — Copa flies to almost every S American city.",connPartners:["CM"]},
      {code:"IAH",name:"Houston Bush",uaDirect:false,note:"UA domestic hub. Connect UA onward to GRU/EZE/SCL/LIM/BOG/PTY. Best for West Coast origins.",connPartners:["UA"]},
      {code:"MIA",name:"Miami",uaDirect:false,note:"AA domestic hub. AA (J class) onward to GRU/EZE/SCL/LIM/BOG. Best for East Coast.",connPartners:["AA","AV","LA"]},
      {code:"DFW",name:"Dallas-Fort Worth",uaDirect:false,note:"AA hub. AA (J class) to GRU/EZE/SCL/LIM/BOG from DFW.",connPartners:["AA"]},
      {code:"YYZ",name:"Toronto",uaDirect:false,note:"AC (J class) from US → AC to GRU/EZE/SCL/LIM/BOG.",connPartners:["AC"]},
    ],
    hubStrategy:[
      {hub:"Direct",note:"UA direct to GRU/EZE/SCL/LIM/BOG from IAH/EWR; AA from MIA/DFW"},
      {hub:"PTY",carrier:"UA/CM",note:"Copa economy mega-hub — connects to every SA city from Panama"},
      {hub:"BOG",carrier:"UA/AV",note:"Avianca economy hub — great SA coverage from Bogotá"},
      {hub:"IAH",carrier:"UA",note:"UA domestic hub — connect to all UA South America routes"},
      {hub:"MIA",carrier:"AA",note:"AA J class hub for South America — MIA/DFW"},
      {hub:"YYZ",carrier:"AC",note:"Air Canada J class to several SA cities"},
    ],
  },
  "Africa":{
    destinations:["JNB","CPT","NBO","ADD","ACC","LOS","CMN","CAI","DAR","MRU"],
    keywords:["africa","south africa","kenya","nairobi","ethiopia","addis ababa","morocco","casablanca","nigeria","lagos","ghana","accra","tanzania","mauritius","cape town","johannesburg"],
    jTrunkCarriers:["UA","BA","QR","EY","LH"],
    econConnectors:["ET","SA","TK","EK","AF","KL","RJ","AT"],
    routingHubs:[
      {code:"ADD",name:"Addis Ababa Bole",uaDirect:false,note:"ET (economy) from IAD direct. Ethiopian mega-hub — connects to 60+ African cities.",connPartners:["ET"]},
      {code:"JNB",name:"Johannesburg OR Tambo",uaDirect:true,note:"UA from EWR (direct, new route). SA economy connections within Southern Africa.",connPartners:["SA"]},
      {code:"ACC",name:"Accra Kotoka",uaDirect:true,note:"UA from IAD/EWR (direct). West Africa gateway.",connPartners:["ET"]},
      {code:"LOS",name:"Lagos Murtala Muhammed",uaDirect:false,note:"Connect via ADD (ET), IST (TK), LHR (BA), or ACC (UA). Major West Africa city.",connPartners:["ET","TK","BA"]},
      {code:"IST",name:"Istanbul",uaDirect:true,note:"UA from IAD/EWR. TK economy mega-hub — flies to 30+ African cities. Best single Africa connector.",connPartners:["TK"]},
      {code:"LHR",name:"London Heathrow",uaDirect:true,note:"UA/AA/BA (J class) from many US cities. BA economy to JNB/CPT/NBO/ACC/LOS/CAI/CMN etc.",connPartners:["BA","ET","SA","KQ"]},
      {code:"CDG",name:"Paris CDG",uaDirect:true,note:"UA/AA from US. AF economy extensive Africa network — West/North/Central Africa.",connPartners:["AF"]},
      {code:"AMS",name:"Amsterdam",uaDirect:true,note:"UA from US. KL economy to NBO/JNB/ACC/LOS/DAR etc.",connPartners:["KL"]},
      {code:"DOH",name:"Doha",uaDirect:false,note:"QR (J class) from US → QR to NBO/JNB/DAR/ADD/CAI/CMN etc.",connPartners:["QR"]},
      {code:"FRA",name:"Frankfurt",uaDirect:true,note:"UA/LH from US. LH economy to NBO/JNB/CAI/ADD etc.",connPartners:["LH","ET"]},
      {code:"CMN",name:"Casablanca",uaDirect:false,note:"AT (economy) connect from CDG/LHR/IST. Royal Air Maroc hub for North/West Africa.",connPartners:["AT"]},
      {code:"NBO",name:"Nairobi JKIA",uaDirect:false,note:"Connect via ADD (ET), IST (TK), LHR (BA), DOH (QR), AMS (KL). East Africa hub.",connPartners:["ET","KQ"]},
    ],
    hubStrategy:[
      {hub:"IST",carrier:"UA/TK",note:"Turkish mega-hub — best single-hub coverage of Africa (30+ cities, economy)"},
      {hub:"ADD",carrier:"ET",note:"Ethiopian Addis hub — economy, intra-Africa king (60+ cities)"},
      {hub:"LHR",carrier:"BA",note:"BA J class from US → BA economy to many African capitals"},
      {hub:"DOH",carrier:"QR",note:"Qatar J class — NBO/JNB/DAR/ADD/CAI and more"},
      {hub:"CDG/AMS",carrier:"AF/KL",note:"Air France + KLM economy — strong West/East Africa networks"},
      {hub:"Direct",note:"UA to JNB (EWR) and ACC (IAD/EWR). Limited but growing."},
    ],
  },
};

// ─── MCT & Cross-Airport Warnings ────────────────────────────────────────────
const AIRPORT_MCT = {
  HNL:{mct:90,note:"Home airline hub. AS/HA connections with highest standby priority."},
  NRT:{mct:120,note:"Immigration can be slow. Allow 2+ hrs for intl-intl."},
  HND:{mct:90,note:"Faster than NRT. 30 min monorail to city."},
  ICN:{mct:120,note:"Large airport. T1↔T2 transfer adds 30 min."},
  TPE:{mct:120,note:"⚠ TSA (Songshan) is 40-60km away — different airport."},
  PVG:{mct:150,note:"Huge airport. Customs slow. SHA (Hongqiao) is 60km away."},
  HKG:{mct:90,note:"Efficient. Good connections."},
  SIN:{mct:90,note:"Excellent hub. Fast connections."},
  BKK:{mct:120,note:"Budget extra for immigration."},
  MNL:{mct:120,note:"T1↔T3 are separate buildings — 2+ hr transfer."},
  IST:{mct:120,note:"Mega-hub. Excellent connection facility."},
  DOH:{mct:90,note:"Modern hub. Efficient connections."},
  AUH:{mct:90,note:"Modern terminal."},
  DXB:{mct:120,note:"Very large. T1↔T3 separate."},
  LHR:{mct:120,note:"T5 (BA) well-organized. T2 (Star Alliance). Allow for security."},
  FRA:{mct:90,note:"Star Alliance hub. Well-organized."},
  MUC:{mct:90,note:"Compact. Efficient."},
  ZRH:{mct:75,note:"Small, efficient."},
  HEL:{mct:75,note:"Compact. Fast transit."},
  VIE:{mct:75,note:"Compact Star Alliance hub."},
  CDG:{mct:120,note:"Large. Allow extra for terminal transfers."},
  AMS:{mct:90,note:"Single terminal. Efficient."},
  YVR:{mct:90,note:"Efficient. Good US preclearance."},
  YYZ:{mct:120,note:"Large. T1 (Star Alliance) vs T3."},
  SYD:{mct:120,note:"Domestic↔Intl terminals separate."},
  NAN:{mct:60,note:"Small, straightforward."},
  GRU:{mct:120,note:"Large. Allow extra time."},
  PTY:{mct:90,note:"Copa hub. Efficient for connections."},
  ADD:{mct:120,note:"Ethiopian hub. Growing."},
};

const CROSS_AIRPORT = {
  "TPE↔TSA":"⚠ TPE (Taoyuan) & TSA (Songshan) are 40-60km apart. Budget 4-6 hrs.",
  "NRT↔HND":"NRT & HND are 80km apart. Budget 3-4 hrs. Limousine bus ~90 min.",
  "PVG↔SHA":"PVG (Pudong) & SHA (Hongqiao) are 60km apart. Budget 3-4 hrs.",
  "JFK↔EWR":"JFK & EWR are different airports. Budget 2-3 hrs.",
  "LHR↔LGW":"LHR & LGW are 70km apart. Budget 3-4 hrs.",
  "ORY↔CDG":"Paris Orly & CDG are 50km apart. Budget 3-4 hrs.",
  "SYD domestic↔intl":"Sydney domestic & intl terminals require bus. Budget 1 hr.",
};

// ─── City → Airport Lookup ───────────────────────────────────────────────────
const CITY_AIRPORTS = [
  // US Cities
  {city:"San Francisco",country:"US",codes:["SFO","OAK","SJC"]},
  {city:"Los Angeles",country:"US",codes:["LAX","ONT","BUR","SNA","LGB"]},
  {city:"New York",country:"US",codes:["JFK","EWR","LGA"]},
  {city:"Washington DC",country:"US",codes:["IAD","DCA","BWI"]},
  {city:"Chicago",country:"US",codes:["ORD","MDW"]},
  {city:"Houston",country:"US",codes:["IAH","HOU"]},
  {city:"Dallas",country:"US",codes:["DFW","DAL"]},
  {city:"Denver",country:"US",codes:["DEN"]},
  {city:"Seattle",country:"US",codes:["SEA"]},
  {city:"Boston",country:"US",codes:["BOS"]},
  {city:"Atlanta",country:"US",codes:["ATL"]},
  {city:"Miami",country:"US",codes:["MIA","FLL"]},
  {city:"Phoenix",country:"US",codes:["PHX"]},
  {city:"Minneapolis",country:"US",codes:["MSP"]},
  {city:"Detroit",country:"US",codes:["DTW"]},
  {city:"Honolulu",country:"US",codes:["HNL"]},
  {city:"Portland",country:"US",codes:["PDX"]},
  {city:"Philadelphia",country:"US",codes:["PHL"]},
  {city:"Orlando",country:"US",codes:["MCO"]},
  {city:"Las Vegas",country:"US",codes:["LAS"]},
  {city:"Salt Lake City",country:"US",codes:["SLC"]},
  {city:"Anchorage",country:"US",codes:["ANC"]},
  // East Asia
  {city:"Tokyo",country:"JP",codes:["NRT","HND"]},
  {city:"Osaka",country:"JP",codes:["KIX","ITM"]},
  {city:"Nagoya",country:"JP",codes:["NGO"]},
  {city:"Fukuoka",country:"JP",codes:["FUK"]},
  {city:"Sapporo",country:"JP",codes:["CTS"]},
  {city:"Okinawa",country:"JP",codes:["OKA"]},
  {city:"Seoul",country:"KR",codes:["ICN","GMP"]},
  {city:"Shanghai",country:"CN",codes:["PVG","SHA"]},
  {city:"Beijing",country:"CN",codes:["PEK","PKX"]},
  {city:"Hong Kong",country:"HK",codes:["HKG"]},
  {city:"Taipei",country:"TW",codes:["TPE","TSA"]},
  // Southeast Asia
  {city:"Singapore",country:"SG",codes:["SIN"]},
  {city:"Bangkok",country:"TH",codes:["BKK","DMK"]},
  {city:"Manila",country:"PH",codes:["MNL"]},
  {city:"Ho Chi Minh City",country:"VN",codes:["SGN"]},
  {city:"Hanoi",country:"VN",codes:["HAN"]},
  {city:"Kuala Lumpur",country:"MY",codes:["KUL"]},
  {city:"Jakarta",country:"ID",codes:["CGK"]},
  {city:"Bali",country:"ID",codes:["DPS"]},
  {city:"Cebu",country:"PH",codes:["CEB"]},
  {city:"Phnom Penh",country:"KH",codes:["PNH"]},
  {city:"Siem Reap",country:"KH",codes:["REP"]},
  // Europe
  {city:"London",country:"GB",codes:["LHR","LGW","STN","LCY"]},
  {city:"Paris",country:"FR",codes:["CDG","ORY"]},
  {city:"Rome",country:"IT",codes:["FCO","CIA"]},
  {city:"Milan",country:"IT",codes:["MXP","LIN"]},
  {city:"Barcelona",country:"ES",codes:["BCN"]},
  {city:"Madrid",country:"ES",codes:["MAD"]},
  {city:"Amsterdam",country:"NL",codes:["AMS"]},
  {city:"Frankfurt",country:"DE",codes:["FRA"]},
  {city:"Munich",country:"DE",codes:["MUC"]},
  {city:"Berlin",country:"DE",codes:["BER"]},
  {city:"Zurich",country:"CH",codes:["ZRH"]},
  {city:"Vienna",country:"AT",codes:["VIE"]},
  {city:"Istanbul",country:"TR",codes:["IST","SAW"]},
  {city:"Athens",country:"GR",codes:["ATH"]},
  {city:"Lisbon",country:"PT",codes:["LIS"]},
  {city:"Dublin",country:"IE",codes:["DUB"]},
  {city:"Edinburgh",country:"GB",codes:["EDI"]},
  {city:"Copenhagen",country:"DK",codes:["CPH"]},
  {city:"Stockholm",country:"SE",codes:["ARN"]},
  {city:"Oslo",country:"NO",codes:["OSL"]},
  {city:"Helsinki",country:"FI",codes:["HEL"]},
  {city:"Prague",country:"CZ",codes:["PRG"]},
  {city:"Warsaw",country:"PL",codes:["WAW"]},
  {city:"Budapest",country:"HU",codes:["BUD"]},
  // Middle East
  {city:"Dubai",country:"AE",codes:["DXB","DWC"]},
  {city:"Abu Dhabi",country:"AE",codes:["AUH"]},
  {city:"Doha",country:"QA",codes:["DOH"]},
  {city:"Amman",country:"JO",codes:["AMM"]},
  {city:"Riyadh",country:"SA",codes:["RUH"]},
  {city:"Jeddah",country:"SA",codes:["JED"]},
  {city:"Tel Aviv",country:"IL",codes:["TLV"]},
  {city:"Cairo",country:"EG",codes:["CAI"]},
  {city:"Muscat",country:"OM",codes:["MCT"]},
  // South Asia
  {city:"Delhi",country:"IN",codes:["DEL"]},
  {city:"Mumbai",country:"IN",codes:["BOM"]},
  {city:"Bangalore",country:"IN",codes:["BLR"]},
  {city:"Chennai",country:"IN",codes:["MAA"]},
  {city:"Colombo",country:"LK",codes:["CMB"]},
  {city:"Kathmandu",country:"NP",codes:["KTM"]},
  // Oceania
  {city:"Sydney",country:"AU",codes:["SYD"]},
  {city:"Melbourne",country:"AU",codes:["MEL"]},
  {city:"Brisbane",country:"AU",codes:["BNE"]},
  {city:"Auckland",country:"NZ",codes:["AKL"]},
  {city:"Fiji",country:"FJ",codes:["NAN"]},
  {city:"Tahiti",country:"PF",codes:["PPT"]},
  // South America
  {city:"São Paulo",country:"BR",codes:["GRU","CGH"]},
  {city:"Rio de Janeiro",country:"BR",codes:["GIG","SDU"]},
  {city:"Buenos Aires",country:"AR",codes:["EZE","AEP"]},
  {city:"Santiago",country:"CL",codes:["SCL"]},
  {city:"Lima",country:"PE",codes:["LIM"]},
  {city:"Bogotá",country:"CO",codes:["BOG"]},
  {city:"Panama City",country:"PA",codes:["PTY"]},
  // Africa
  {city:"Johannesburg",country:"ZA",codes:["JNB"]},
  {city:"Cape Town",country:"ZA",codes:["CPT"]},
  {city:"Nairobi",country:"KE",codes:["NBO"]},
  {city:"Addis Ababa",country:"ET",codes:["ADD"]},
  {city:"Accra",country:"GH",codes:["ACC"]},
  {city:"Lagos",country:"NG",codes:["LOS"]},
  {city:"Casablanca",country:"MA",codes:["CMN"]},
  // Canada
  {city:"Toronto",country:"CA",codes:["YYZ","YTZ"]},
  {city:"Vancouver",country:"CA",codes:["YVR"]},
  {city:"Montreal",country:"CA",codes:["YUL"]},
  // Mexico & Caribbean
  {city:"Mexico City",country:"MX",codes:["MEX"]},
  {city:"Cancún",country:"MX",codes:["CUN"]},
  {city:"San Juan",country:"PR",codes:["SJU"]},
];

const US_GATEWAYS = ["SFO","LAX","EWR","IAD","ORD","IAH","DEN","SEA","BOS","JFK","ATL","DFW","MIA","PHX","MSP","DTW","HNL"];

const STORAGE_KEY = "nonrev-planner-v3";
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ─── Tier Logic ──────────────────────────────────────────────────────────────
function getRemaining(open, listed) {
  if (open === null || open === undefined) return null;
  if (listed === "" || listed === null || listed === undefined) return null;
  const l = parseInt(listed,10); return isNaN(l) ? null : open - l;
}
function calcTier(isDirect, isLate, remaining, open) {
  if (open === null || open === undefined) return 3; // no data yet — show as backup until seats entered
  if (open === 0) return 4;
  if (isDirect) return 1;
  if (isLate) { return (remaining !== null && remaining <= 0) ? 4 : 3; }
  if (remaining === null) { return open >= 10 ? 1 : open >= 6 ? 2 : 3; }
  return remaining >= 2 ? 1 : remaining >= 0 ? 2 : 3;
}
const TIER_META = {
  1:{label:"⭐ Priority",bg:"#f0fdf4",border:"#86efac",badge:"#dcfce7",badgeText:"#065f46",accent:"#059669"},
  2:{label:"✓ Good",bg:"#eff6ff",border:"#93c5fd",badge:"#dbeafe",badgeText:"#1e3a8a",accent:"#2563eb"},
  3:{label:"△ Backup",bg:"#fffbeb",border:"#fcd34d",badge:"#fef3c7",badgeText:"#78350f",accent:"#d97706"},
  4:{label:"✗ Unlikely",bg:"#fef2f2",border:"#fca5a5",badge:"#fee2e2",badgeText:"#991b1b",accent:"#dc2626"},
};
const ALERT_STYLE = {red:{bg:"#fee2e2",color:"#991b1b",border:"#fca5a5"},amber:{bg:"#fef3c7",color:"#78350f",border:"#fcd34d"},green:{bg:"#d1fae5",color:"#065f46",border:"#86efac"}};

// Aircraft size for connection scoring (larger = better standby odds)
const AC_SIZE={"A380":10,"B777":9,"A350":8,"B787-10":7,"A330":7,"B787-9":6,"B787-8":5,"B767":4,"A321":3,"A320":2,"B737":1,"737":1,"E190":1,"E175":1,"CRJ":0,"ATR":0,"Dash":0,"Q400":0};
function acScore(ac){if(!ac)return 0;for(const[k,v]of Object.entries(AC_SIZE)){if(ac.includes(k))return v;}return 1;}

// Sort connections: home airline → shortest feasible layover → larger aircraft → J-eligible
function sortConnections(conns){
  return [...conns].sort((a,b)=>{
    // Home airlines first
    const aHome=AGREEMENTS[a.airlineCode]?.home?1:0;
    const bHome=AGREEMENTS[b.airlineCode]?.home?1:0;
    if(aHome!==bHome) return bHome-aHome;
    // J-eligible above Y-only
    const aJ=AGREEMENTS[a.airlineCode]?.j?1:0;
    const bJ=AGREEMENTS[b.airlineCode]?.j?1:0;
    if(aJ!==bJ) return bJ-aJ;
    // Shortest feasible layover (treat <2 as tight — penalize slightly)
    const aLay=a.layoverHrs||99;
    const bLay=b.layoverHrs||99;
    const aLayScore=aLay<2?aLay+100:aLay; // penalize too-tight connections
    const bLayScore=bLay<2?bLay+100:bLay;
    if(Math.abs(aLayScore-bLayScore)>0.5) return aLayScore-bLayScore;
    // Larger aircraft
    return acScore(b.ac)-acScore(a.ac);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") await onSignup(email, pass);
      else await onLogin(email, pass);
    } catch (err) {
      setError(
        err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" ? "Wrong email or password" :
        err.code === "auth/user-not-found" ? "No account with that email" :
        err.code === "auth/email-already-in-use" ? "Email already registered — sign in instead" :
        err.code === "auth/weak-password" ? "Password must be at least 6 characters" :
        err.code === "auth/invalid-email" ? "Invalid email address" :
        err.message
      );
    }
    setLoading(false);
  };

  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#f5f4f0",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:"40px 36px",maxWidth:380,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <span style={{fontSize:32}}>✈</span>
          <h1 style={{fontSize:20,fontWeight:800,margin:"8px 0 4px",color:"#111827"}}>Non-Rev Planner</h1>
          <p style={{fontSize:12,color:"#9ca3af"}}>Sign in to sync trips across devices</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"
            style={{fontSize:13,padding:"10px 12px",borderRadius:8,border:"1.5px solid #e5e7eb",outline:"none",width:"100%",boxSizing:"border-box"}}/>
          <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{fontSize:13,padding:"10px 12px",borderRadius:8,border:"1.5px solid #e5e7eb",outline:"none",width:"100%",boxSizing:"border-box"}}/>
          {error&&<div style={{fontSize:12,color:"#dc2626",background:"#fef2f2",padding:"8px 12px",borderRadius:8}}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading||!email||!pass}
            style={{fontSize:14,fontWeight:700,padding:"12px",background:loading?"#93c5fd":"#2563eb",color:"#fff",border:"none",borderRadius:8,cursor:loading?"wait":"pointer"}}>
            {loading?"Signing in…":mode==="signup"?"Create Account":"Sign In"}
          </button>
          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");}}
            style={{fontSize:12,color:"#6b7280",background:"none",border:"none",cursor:"pointer"}}>
            {mode==="login"?"Don't have an account? Sign up":"Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function NonRevPlanner() {
  const [screen, setScreen] = useState("dashboard");
  const [trips, setTrips] = useState({});
  const [curId, setCurId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [user, setUser] = useState(null);
const [authLoading, setAuthLoading] = useState(true);

// Listen for auth state
useEffect(() => {
  const unsub = onAuthChange((u) => {
    setUser(u);
    setAuthLoading(false);
  });
  return unsub;
}, []);

// Load trips when user signs in
useEffect(() => {
  if (!user) { setTrips({}); setLoaded(false); return; }
  (async () => {
    try {
      const r = await firebaseStorage.get(STORAGE_KEY);
      if (r?.value) setTrips(JSON.parse(r.value));
    } catch(_) {}
    setLoaded(true);
  })();
}, [user]);

const save = useCallback(async (t) => {
  setTrips(t);
  try { await firebaseStorage.set(STORAGE_KEY, JSON.stringify(t)); } catch(_) {}
}, []);
  const trip = curId ? trips[curId] : null;
  const go = (s,id) => { if(id!==undefined) setCurId(id); setScreen(s); };
  const goHome = () => { setCurId(null); setScreen("dashboard"); };

if (authLoading) return <Loading />;
if (!user) return <LoginScreen onLogin={login} onSignup={signup} />;
if (!loaded) return <Loading />;
  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#f5f4f0",minHeight:"100vh",color:"#1f2937",overflowX:"hidden"}}>
      <Header screen={screen} goHome={goHome} goRules={()=>setScreen("rules")} onLogout={logout}/>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"20px 16px"}}>
        {screen==="dashboard" && <Dashboard trips={trips} open={(id)=>go("tracker",id)} del={async(id)=>{const n={...trips};delete n[id];await save(n);if(curId===id)goHome();}} onNew={()=>go("new")}/>}
        {screen==="new" && <NewTrip onCancel={goHome} onCreate={async(d)=>{const id=uid();const t={id,...d,routes:[],userData:{},createdAt:Date.now()};const n={...trips,[id]:t};await save(n);go("research",id);}}/>}
        {screen==="research" && trip && <Research trip={trip} onDone={async(routes)=>{const n={...trips,[curId]:{...trip,routes,researchedAt:Date.now()}};await save(n);go("tracker",curId);}} onSkip={()=>go("tracker",curId)}/>}
        {screen==="tracker" && trip && <Tracker trip={trip} onUpdate={async(u)=>{const n={...trips,[curId]:{...trip,...u}};await save(n);}} onReSearch={()=>go("research",curId)} goHome={goHome}/>}
        {screen==="rules" && <Rules/>}
      </div>
    </div>
  );
}

function Loading(){return <div style={{padding:60,textAlign:"center",color:"#6b7280",fontFamily:"monospace",background:"#f5f4f0",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#059669"}}>▍</span> Loading…</div>;}

function Header({screen,goHome,goRules,onLogout}){return(
  <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"12px 20px",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)"}}>
    <div style={{maxWidth:1140,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={goHome}>
        <span style={{fontSize:18}}>✈</span>
        <div><div style={{fontSize:14,fontWeight:800,color:"#fff",letterSpacing:"-.02em"}}>Non-Rev Planner</div>
        <div style={{fontSize:8,color:"#64748b",fontFamily:"monospace",letterSpacing:".1em"}}>ALASKA ZED/MIBA · {J_PARTNERS.length} J PARTNERS · {Y_PARTNERS.length} Y PARTNERS</div></div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {screen!=="dashboard"&&<Btn onClick={goHome} dim>← Trips</Btn>}
        <Btn onClick={goRules} active={screen==="rules"}>Airline Rules</Btn>
        {onLogout&&<button onClick={onLogout} style={{fontSize:10,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",marginLeft:4}}>Sign out</button>}
      </div>
    </div>
  </div>
);}

function Btn({children,onClick,active,dim,disabled,big,accent}){return <button onClick={onClick} disabled={disabled} style={{fontSize:big?13:11,padding:big?"10px 24px":"6px 14px",background:accent?"#2563eb":active?"#2563eb":dim?"#f3f4f6":"#f3f4f6",color:disabled?"#9ca3af":accent||active?"#fff":dim?"#6b7280":"#4b5563",border:"1px solid "+(accent||active?"#2563eb":"#d4d4d8"),borderRadius:big?9:7,cursor:disabled?"not-allowed":"pointer",fontWeight:active||accent||big?700:500,opacity:disabled?.5:1}}>{children}</button>;}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({trips,open,del,onNew}){
  const list = Object.values(trips).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const [confirmId,setConfirmId]=useState(null);
  return (<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px",color:"#111827"}}>Your Trips</h2><p style={{fontSize:12,color:"#9ca3af",margin:0}}>{list.length} trip{list.length!==1?"s":""} · J class on {J_PARTNERS.length} airlines · Y class on {Y_PARTNERS.length} airlines</p></div>
      <Btn onClick={onNew} accent big>+ New Trip</Btn>
    </div>
    {list.length===0 ? (
      <div style={{textAlign:"center",padding:"60px 20px",background:"#ffffff",borderRadius:14,border:"1px solid #e5e7eb"}}>
        <div style={{fontSize:40,marginBottom:12}}>✈</div>
        <div style={{fontSize:16,fontWeight:700,color:"#111827",marginBottom:6}}>No trips yet</div>
        <div style={{fontSize:13,color:"#9ca3af",marginBottom:20}}>Plan a non-rev standby trip with your full ZED/MIBA agreement network.</div>
        <Btn onClick={onNew} accent big>+ Create Trip</Btn>
      </div>
    ) : (
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {list.map(t=>{
          const rc=(t.routes||[]).length, dc=(t.routes||[]).filter(r=>r.isDirect).length;
          const jAirlines = [...new Set((t.routes||[]).flatMap(r=>[r.trunkCarrier,...(r.connections||[]).map(c=>c.airlineCode)]).filter(Boolean))];
          return(
            <div key={t.id} style={{background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:12,cursor:"pointer",transition:"border-color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#2563eb"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
              <div onClick={()=>open(t.id)} style={{padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:10,padding:"3px 10px",borderRadius:99,background:"#f3f4f6",color:"#6b7280",fontWeight:600,fontFamily:"monospace"}}>{t.cabin==="J"?"Business":"Economy"}</span>
                  <span style={{fontSize:10,color:"#9ca3af"}}>{t.travelDate||"Flexible"}</span>
                </div>
                <div style={{fontSize:20,fontWeight:900,color:"#111827",marginBottom:3,letterSpacing:"-.02em"}}>{t.origin} → {t.destination}</div>
                <div style={{fontSize:12,color:"#9ca3af",marginBottom:8}}>{t.name}</div>
                <div style={{display:"flex",gap:10,fontSize:11,color:"#9ca3af",flexWrap:"wrap"}}>
                  <span>{rc} route{rc!==1?"s":""}</span>
                  {dc>0&&<span style={{color:"#059669"}}>{dc} direct</span>}
                  {jAirlines.length>0&&<span>{jAirlines.slice(0,5).join(", ")}{jAirlines.length>5?`+${jAirlines.length-5}`:""}</span>}
                </div>
              </div>
              <div style={{borderTop:"1px solid #e5e7eb",padding:"6px 18px",display:"flex",justifyContent:"flex-end",gap:6}}>
                {confirmId===t.id ? (<>
                  <button onClick={e=>{e.stopPropagation();setConfirmId(null);}} style={{fontSize:10,color:"#6b7280",background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>Cancel</button>
                  <button onClick={e=>{e.stopPropagation();del(t.id);setConfirmId(null);}} style={{fontSize:10,color:"#fff",background:"#dc2626",border:"none",borderRadius:4,cursor:"pointer",padding:"4px 10px",fontWeight:600}}>Confirm Delete</button>
                </>) : (
                  <button onClick={e=>{e.stopPropagation();setConfirmId(t.id);}} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>Delete</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW TRIP
// ═══════════════════════════════════════════════════════════════════════════════
function NewTrip({onCancel,onCreate}){
  const [name,setName]=useState("");
  const [originText,setOriginText]=useState("San Francisco");
  const [originCodes,setOriginCodes]=useState(["SFO"]);
  const [destText,setDestText]=useState("");
  const [destCodes,setDestCodes]=useState([]);
  const [date,setDate]=useState("");
  const [flexDays,setFlexDays]=useState(0);
  const [cabin,setCabin]=useState("J");
  const [travelers,setTrav]=useState("2");
  const [trunkAirline,setTrunkAirline]=useState("all");
  const originDisplay = originCodes.length>0 ? originCodes.join("/") : originText.toUpperCase().slice(0,3);
  const destDisplay = destCodes.length>0 ? destCodes.join("/") : destText;
  const ok = originDisplay.length>=2 && destDisplay.length>=2;

  const eligibleTrunk = useMemo(()=>{
    const codes = cabin==="J" ? J_PARTNERS : Y_PARTNERS;
    return [{code:"all",label:"All airlines"},...codes.map(c=>({code:c,label:`${c} — ${AGREEMENTS[c]?.name||c}${AGREEMENTS[c]?.home?" ★ HOME":""}${AGREEMENTS[c]?.alliance?` (${AGREEMENTS[c].alliance})`:""}`}))];
  },[cabin]);

  useEffect(()=>{
    if(trunkAirline!=="all" && !eligibleTrunk.find(e=>e.code===trunkAirline)) setTrunkAirline("all");
  },[cabin]);

  const regionHint = useMemo(()=>{
    // Check both origin and destination — pick the international (non-US) region
    const searchTexts = [
      (destText+destCodes.join(" ")).toLowerCase(),
      (originText+originCodes.join(" ")).toLowerCase(),
    ];
    for(const d of searchTexts){
      for(const[region,data] of Object.entries(REGIONS)){
        if(data.destinations.some(a=>d.includes(a.toLowerCase()))||data.keywords.some(k=>d.includes(k)))
          return {region,data};
      }
    }
    return null;
  },[destText,destCodes,originText,originCodes]);

  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <h2 style={{fontSize:22,fontWeight:800,color:"#111827",marginBottom:4}}>New Trip</h2>
      <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>
        {trunkAirline==="all"
          ? `We'll research routes across all ${cabin==="J"?J_PARTNERS.length:Y_PARTNERS.length} ${cabin==="J"?"business":"economy"} class partner airlines.`
          : `Trunk leg: ${AGREEMENTS[trunkAirline]?.name||trunkAirline} only. Connections: all eligible partners.`}
      </p>
      <div style={{background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:14,padding:"24px 28px",display:"flex",flexDirection:"column",gap:20}}>
        <FG label="Trip Name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Insert trip name here" style={INP}/></FG>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <FG label="From">
            <CitySearch value={originText} codes={originCodes} placeholder="City or airport code"
              onChange={(text,codes)=>{setOriginText(text);setOriginCodes(codes);}} />
          </FG>
          <div style={{textAlign:"center",fontSize:18,color:"#d1d5db",margin:"-4px 0"}}>↓</div>
          <FG label="To">
            <CitySearch value={destText} codes={destCodes} placeholder="City or airport code"
              onChange={(text,codes)=>{setDestText(text);setDestCodes(codes);}} />
          </FG>
        </div>

        {regionHint && (
          <div style={{padding:"10px 14px",background:"#f0f4ff",border:"1px solid #e5e7eb",borderRadius:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#2563eb",marginBottom:4}}>Detected: {regionHint.region}</div>
            <div style={{fontSize:10,color:"#9ca3af"}}>
              J trunk carriers: {regionHint.data.jTrunkCarriers.map(c=>`${c} (${AGREEMENTS[c]?.name||c})`).join(", ")}
            </div>
            <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>+ {regionHint.data.econConnectors.length} economy connection airlines</div>
          </div>
        )}
        <FG label="Travel Date">
          <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...INP,flex:"1 1 160px",minWidth:140}}/>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9ca3af",fontFamily:"monospace"}}>FLEX</div>
              <div style={{display:"flex",gap:4}}>
                {[{v:0,l:"Exact"},{v:1,l:"±1"},{v:2,l:"±2"},{v:3,l:"±3"}].map(f=>(
                  <button key={f.v} onClick={()=>setFlexDays(f.v)} style={{fontSize:11,padding:"6px 10px",borderRadius:6,border:"1.5px solid "+(flexDays===f.v?"#2563eb":"#d4d4d8"),background:flexDays===f.v?"#eff6ff":"#fff",color:flexDays===f.v?"#2563eb":"#6b7280",cursor:"pointer",fontWeight:flexDays===f.v?700:400}}>{f.l}</button>
                ))}
              </div>
            </div>
          </div>
          {date && flexDays > 0 && (
            <div style={{fontSize:10,color:"#6b7280",marginTop:6}}>
              Searching {(() => {
                const d = new Date(date + "T00:00:00");
                const start = new Date(d); start.setDate(start.getDate() - flexDays);
                const end = new Date(d); end.setDate(end.getDate() + flexDays);
                return `${start.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${end.toLocaleDateString("en-US",{month:"short",day:"numeric"})} (${flexDays*2+1} days)`;
              })()}
            </div>
          )}
        </FG>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
          <FG label="Cabin Priority (trunk leg)">
            <div style={{display:"flex",gap:6}}>
              {[{v:"J",l:"Business (J)",sub:`${J_PARTNERS.length} airlines`},{v:"Y",l:"Economy (Y)",sub:`${Y_PARTNERS.length} airlines`}].map(o=>(
                <button key={o.v} onClick={()=>setCabin(o.v)} style={{flex:1,padding:"10px",borderRadius:8,border:"1.5px solid "+(cabin===o.v?"#2563eb":"#d4d4d8"),background:cabin===o.v?"#eff6ff":"transparent",color:cabin===o.v?"#2563eb":"#6b7280",cursor:"pointer",fontSize:12,fontWeight:cabin===o.v?700:400}}>
                  {o.l}<br/><span style={{fontSize:9,opacity:.6}}>{o.sub}</span>
                </button>
              ))}
            </div>
          </FG>
          <FG label="Travelers"><input type="number" min="1" max="9" value={travelers} onChange={e=>setTrav(e.target.value)} style={INP}/></FG>
        </div>

        <FG label="Trunk Airline (optional — filter to one carrier for the outbound leg)">
          <select value={trunkAirline} onChange={e=>setTrunkAirline(e.target.value)} style={{...INP,cursor:"pointer",appearance:"auto"}}>
            {eligibleTrunk.map(e=><option key={e.code} value={e.code}>{e.label}</option>)}
          </select>
          {trunkAirline!=="all" && (
            <div style={{marginTop:6,padding:"8px 12px",background:AGREEMENTS[trunkAirline]?.home?"#f0fdf4":"#eff6ff",border:"1px solid "+(AGREEMENTS[trunkAirline]?.home?"#86efac":"#bfdbfe"),borderRadius:7,fontSize:11,color:AGREEMENTS[trunkAirline]?.home?"#065f46":"#1e40af"}}>
              {AGREEMENTS[trunkAirline]?.home && <span style={{fontWeight:700}}>★ Home airline — highest standby priority. </span>}
              Only {AGREEMENTS[trunkAirline]?.name} routes will be searched for the {cabin==="J"?"business":"economy"} class trunk leg from {originDisplay}. Connections to final destination will include all eligible partner airlines.
            </div>
          )}
        </FG>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
          <Btn onClick={onCancel} dim>Cancel</Btn>
          <Btn onClick={()=>onCreate({
            name:name||`${originDisplay} → ${destDisplay}`,
            origin:originDisplay, originCodes, destination:destDisplay, destCodes,
            travelDate:date, flexDays, cabin, travelers:parseInt(travelers)||2,
            trunkAirline:trunkAirline==="all"?null:trunkAirline
          })} disabled={!ok} accent big>Research Routes →</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── City Search Autocomplete ────────────────────────────────────────────────
function CitySearch({value,codes,placeholder,onChange}){
  const [text,setText]=useState(value||"");
  const [open,setOpen]=useState(false);
  const [focused,setFocused]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{setText(value||"");},[value]);

  const matches = useMemo(()=>{
    if(!text||text.length<1) return [];
    const q=text.toLowerCase();
    const results=[];
    // Match cities
    CITY_AIRPORTS.forEach(c=>{
      if(c.city.toLowerCase().includes(q)||c.codes.some(code=>code.toLowerCase().includes(q))||c.country.toLowerCase().includes(q))
        results.push(c);
    });
    return results.slice(0,8);
  },[text]);

  const handleSelect=(match)=>{
    setText(match.city);
    onChange(match.city, match.codes);
    setOpen(false);
  };

  const handleType=(val)=>{
    setText(val);
    setOpen(val.length>=1);
    // If user types a raw 3-letter code, auto-resolve
    const upper=val.toUpperCase().trim();
    if(upper.length===3 && /^[A-Z]{3}$/.test(upper)){
      const found=CITY_AIRPORTS.find(c=>c.codes.includes(upper));
      if(found) onChange(found.city, found.codes);
      else onChange(upper, [upper]);
    } else if(val.length<2){
      onChange(val,[]);
    }
  };

  const handleBlur=()=>{ setTimeout(()=>setOpen(false),200); setFocused(false); };

  return(
    <div style={{position:"relative"}} ref={ref}>
      <input value={text} onChange={e=>handleType(e.target.value)} onFocus={()=>{setFocused(true);if(text.length>=1)setOpen(true);}} onBlur={handleBlur}
        placeholder={placeholder} style={{...INP,fontSize:14,fontWeight:700}} />
      {codes.length>0 && (
        <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
          {codes.map(c=><span key={c} style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",fontFamily:"monospace"}}>{c}</span>)}
        </div>
      )}
      {open && matches.length>0 && focused && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:2}}>
          {matches.map((m,i)=>(
            <div key={i} onMouseDown={()=>handleSelect(m)} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f5f5f5",display:"flex",justifyContent:"space-between",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
              <div>
                <span style={{fontSize:13,fontWeight:700,color:"#111827"}}>{m.city}</span>
                <span style={{fontSize:11,color:"#9ca3af",marginLeft:6}}>{m.country}</span>
              </div>
              <div style={{display:"flex",gap:3}}>
                {m.codes.map(c=><span key={c} style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:"#f3f4f6",color:"#374151",fontFamily:"monospace"}}>{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function FG({label,children}){return <div><div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6,fontFamily:"monospace"}}>{label}</div>{children}</div>;}
const INP={width:"100%",fontSize:13,padding:"10px 12px",background:"#ffffff",border:"1.5px solid #d4d4d8",borderRadius:8,color:"#111827",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH ENGINE — Claude API + Web Search
// ═══════════════════════════════════════════════════════════════════════════════
function Research({trip,onDone,onSkip}){
  const [status,setStatus]=useState("idle");
  const [log,setLog]=useState([]);
  const [error,setError]=useState(null);
  const started=useRef(false);
  const addLog=(msg)=>setLog(p=>[...p,{t:Date.now(),msg}]);

  useEffect(()=>{if(!started.current){started.current=true;run();}}, []);

  async function run(){
    setStatus("searching");
    // Resolve origin airports — may be multiple for a city (e.g., SFO/OAK/SJC for San Francisco)
    const originAirports = (trip.originCodes && trip.originCodes.length > 0) ? trip.originCodes : [trip.origin];
    const originStr = originAirports.join("/");
    const originPromptStr = originAirports.length > 1
      ? `${originAirports.join(", ")} (all airports serving ${trip.origin})`
      : originAirports[0];
    addLog(`Researching ${originStr} → ${trip.destination}…`);

    // Detect region — check both destination AND origin (for reverse trips like Tokyo→SFO)
    const searchTexts = [
      (trip.destination||"").toLowerCase() + " " + ((trip.destCodes||[]).join(" ")).toLowerCase(),
      (trip.origin||"").toLowerCase() + " " + ((trip.originCodes||[]).join(" ")).toLowerCase(),
    ];
    let matchedRegion = null, matchedData = null;
    for(const searchText of searchTexts){
      for(const[region,data] of Object.entries(REGIONS)){
        if(data.destinations.some(a=>searchText.includes(a.toLowerCase()))||data.keywords.some(k=>searchText.includes(k))){
          matchedRegion=region; matchedData=data; break;
        }
      }
      if(matchedRegion) break;
    }

    const cabinJ = trip.cabin === "J";
    let trunkCarriers, connCarriers;
    if(matchedData){
      trunkCarriers = cabinJ ? matchedData.jTrunkCarriers : [...matchedData.jTrunkCarriers,...matchedData.econConnectors];
      connCarriers = matchedData.econConnectors;
      addLog(`Region: ${matchedRegion}`);
    } else {
      trunkCarriers = cabinJ ? J_PARTNERS : Y_PARTNERS;
      connCarriers = Y_PARTNERS;
      addLog("No region match — broad search across all partners.");
    }

    // Apply trunk airline filter if user selected a specific carrier
    const trunkFilter = trip.trunkAirline || null;
    if (trunkFilter) {
      // Validate: if J cabin selected, trunk airline must have J agreement
      if (cabinJ && AGREEMENTS[trunkFilter] && !AGREEMENTS[trunkFilter].j) {
        addLog(`⚠ ${AGREEMENTS[trunkFilter].name} has economy-only agreement — no J class available on trunk`);
      }
      trunkCarriers = [trunkFilter];
      addLog(`⚡ Trunk airline filter: ${AGREEMENTS[trunkFilter]?.name||trunkFilter} (${trunkFilter}) only`);
      // Expand connection pool — when filtering to one trunk airline, ensure ALL economy partners are available for connections
      if (matchedData) {
        const allConn = new Set([...matchedData.econConnectors, ...matchedData.jTrunkCarriers.filter(c=>c!==trunkFilter)]);
        connCarriers = [...allConn];
      }
    } else {
      // Always include home airlines at front when searching all
      ["AS","HA"].forEach(h=>{if(!trunkCarriers.includes(h))trunkCarriers.unshift(h);});
    }
    addLog(`Trunk carriers (${cabinJ?"J":"Y"}): ${trunkCarriers.join(", ")}${!trunkFilter?" — AS/HA = HOME priority":""}`);
    addLog(`Connection carriers: ${connCarriers.join(", ")}`);

    const trunkNames = trunkCarriers.filter(c=>AGREEMENTS[c]).map(c=>`${c} (${AGREEMENTS[c].name})`).join(", ");
    const connNames = connCarriers.filter(c=>AGREEMENTS[c]).map(c=>`${c} (${AGREEMENTS[c].name})`).join(", ");
    const flex = trip.flexDays || 0;
    const dateStr = trip.travelDate
      ? (flex > 0
        ? `between ${(() => { const d=new Date(trip.travelDate+"T00:00:00"); const s=new Date(d); s.setDate(s.getDate()-flex); const e=new Date(d); e.setDate(e.getDate()+flex); return `${s.toISOString().slice(0,10)} and ${e.toISOString().slice(0,10)} (±${flex} days from ${trip.travelDate})`; })()}`
        : `on or around ${trip.travelDate}`)
      : "in the near future";
    const hubNotes = matchedData ? matchedData.hubStrategy.map(h=>`- ${h.hub}: ${h.carrier||""} — ${h.note}`).join("\n") : "";

    // Build explicit routing hub instructions if we have them
    let routingHubInstructions = "";
    if (matchedData?.routingHubs) {
      let hubs = matchedData.routingHubs;
      // When filtering to a specific trunk airline, only include relevant hubs
      if (trunkFilter) {
        if (trunkFilter === "UA" || trunkFilter === "AS") {
          // Show UA/AS direct hubs + HNL for AS
          hubs = hubs.filter(h => h.uaDirect || (trunkFilter==="AS" && h.isHome) || h.code==="HNL");
        } else if (trunkFilter === "HA") {
          hubs = hubs.filter(h => h.code==="HNL" || h.isHome);
        } else {
          // For other airlines (QR, BA, LH etc.), show only the hubs they fly to
          hubs = hubs.filter(h => !h.uaDirect && h.connPartners.includes(trunkFilter));
          // If no matching hubs, fall back to all non-UA hubs
          if (hubs.length === 0) hubs = matchedData.routingHubs.filter(h => !h.uaDirect);
        }
      }
      const directHubs = hubs.filter(h=>h.uaDirect);
      const partnerHubs = hubs.filter(h=>!h.uaDirect);

      const trunkLabel = trunkFilter ? (AGREEMENTS[trunkFilter]?.name||trunkFilter) : "UA/AS";
      routingHubInstructions = `
MANDATORY ROUTING HUBS TO CHECK — search for ${trunkLabel} flights to ALL of these from ${originPromptStr}:
${directHubs.length>0?`
${trunkLabel} ROUTES TO ASIAN HUBS (check each one — do NOT skip any):
${directHubs.map(h=>`- ${originPromptStr} → ${h.code} (${h.name}): ${h.note}${h.connPartners.length>0?` → then connections on ${h.connPartners.join("/")} to final destination`:""}`).join("\n")}
`:""}${partnerHubs.length>0?`
PARTNER HUB ROUTES:
${partnerHubs.map(h=>`- Via ${h.code} (${h.name}): ${h.note}. Connections: ${h.connPartners.join(", ")}`).join("\n")}
`:""}
You MUST include a hub_route entry for EACH hub where you find a viable ${trunkLabel} flight from ${originPromptStr}. Do not skip any hub just because another exists.`;
      addLog(`Routing hubs: ${hubs.map(h=>h.code).join(", ")}`);
    }

    // Build the airline constraint section of the prompt
    const airlineConstraint = trunkFilter
      ? `\nIMPORTANT: The traveler has selected ${AGREEMENTS[trunkFilter]?.name||trunkFilter} (${trunkFilter}) as their ONLY trunk airline. Search ONLY for ${trunkFilter} flights from ${originPromptStr} to hub airports. Do NOT include flights on other airlines for the trunk leg. Connections from the hub to the final destination can be on ANY of the connection carriers listed above.`
      : `\nCRITICAL: Alaska Airlines (AS) and Hawaiian Airlines (HA) are the traveler's HOME airlines — highest standby priority. Always search AS/HA routes first, including via Honolulu (HNL).`;

    // Build explicit J vs Y airline lists for the prompt
    const jPartnerList = trunkCarriers.filter(c=>AGREEMENTS[c]?.j).map(c=>`${c}`).join(", ");
    const yOnlyList = [...new Set([...trunkCarriers,...connCarriers])].filter(c=>AGREEMENTS[c]&&!AGREEMENTS[c].j).map(c=>`${c}`).join(", ");

    const prompt = `You are a non-rev standby travel researcher for airline employees.
    Find flight routing options from ${originPromptStr} to ${trip.destination} ${dateStr}.
    The traveler is an ALASKA AIRLINES employee with ZED/MIBA standby agreements.
    They want ${cabinJ ? "BUSINESS CLASS (J)" : "ECONOMY (Y)"} on the trunk leg.
    ${airlineConstraint}
    STRICT RULE — ONLY include airlines from these lists:
    BUSINESS CLASS (J) agreement airlines: ${jPartnerList}
    ECONOMY ONLY (Y) airlines — NO business class: ${yOnlyList}
    TRUNK LEG CARRIER${trunkFilter ? "" : "S"}: ${trunkNames}
    CONNECTION CARRIERS (economy): ${connNames}
    ${routingHubInstructions}
    Return ONLY valid JSON:
    {
      "direct_flights": [{"airline":"UA","flight_number":"UA 837","departure_time":"11:40","arrival_time":"15:00+1","aircraft":"B777-300ER","origin":"${originPromptStr}","destination":"NRT","duration_hrs":11,"frequency":"daily"}],
      "hub_routes": [{"hub_code":"HNL","hub_name":"Honolulu","trunk_flight":{"airline":"HA","flight_number":"HA 11","departure_time":"08:00","aircraft":"A330-200","duration_hrs":5.5},"connections":[{"airline":"HA","flight_number":"HA 863","departure_time":"16:30","arrival_time":"19:50+1","aircraft":"A330-200","destination":"NRT","layover_hrs":3}],"hub_notes":"SEPARATE entries."}]
    }`;

    addLog("Initiating Claude Research (Priority 1)...");
    let text = "";

    try {
      // 1. PRIMARY ATTEMPT: CLAUDE
      const resp = await fetch("/.netlify/functions/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt, engine: "claude" })
      });

      const data = await resp.json();
      
      // LOGS FOR TROUBLESHOOTING IN BROWSER CONSOLE (F12)
      console.log("DEBUG: Claude Status:", resp.status);
      console.log("DEBUG: Claude Response Data:", data);

      if (resp.ok && data.content && data.content.length > 0) {
        text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
        addLog("Claude Research successful — parsing...");
      } else {
        // CLAUDE FAILED: Log error and move to Gemini
        const errorDetail = data.error?.message || "Unknown Claude Error";
        console.error("CLAUDE FAILURE:", errorDetail);
        addLog(`Claude unavailable: ${errorDetail}. Switching to Gemini fallback...`);

        // 2. SECONDARY ATTEMPT: GEMINI FALLBACK via Function
        const geminiResp = await fetch("/.netlify/functions/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt, engine: "gemini" })
        });

        const geminiData = await geminiResp.json();
        console.log("DEBUG: Gemini Response Data:", geminiData);

        if (!geminiResp.ok) throw new Error(geminiData.error || "Both Research Engines Failed.");

        // Parsing Gemini's specific JSON structure
        text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        addLog("Gemini Fallback successful — parsing...");
      }

      setStatus("parsing");

      (parsed.hub_routes||[]).forEach(hr=>{
        const trunk=hr.trunk_flight||{};
        const trunkCode=trunk.airline||"??";
        const trunkPartner=AGREEMENTS[trunkCode];
        // SKIP trunk airlines we have NO agreement with
        if (!trunkPartner) { addLog(`⚠ Skipped hub route via ${hr.hub_code} on ${trunkCode} — not a partner`); return; }
        // When searching J class, trunk must be on a J-agreement airline
        if (cabinJ && !trunkPartner.j) { addLog(`⚠ Skipped hub route via ${hr.hub_code} on ${trunkCode} — economy-only (no J class)`); return; }
        const trunkCabin = trunkPartner.j ? "J" : "Y";

        // Pre-process: split any grouped connections (e.g., "HA 50/51/52" → 3 entries)
        const rawConns = hr.connections || [];
        const splitConns = [];
        rawConns.forEach(c => {
          const fn = c.flight_number || "";
          // Check for grouped flights: "HA 50/51/52" or "HA 50, HA 51" or "HA 50 / HA 51"
          const slashParts = fn.split(/\s*[\/,]\s*/);
          if (slashParts.length > 1) {
            // Extract airline code from first part
            const airlineMatch = slashParts[0].match(/^([A-Z]{2})\s*/);
            const airlineCode = airlineMatch ? airlineMatch[1] : (c.airline || "??");
            slashParts.forEach(part => {
              const numMatch = part.match(/\d+/);
              if (numMatch) {
                const fullFn = part.match(/^[A-Z]{2}/) ? part : `${airlineCode} ${numMatch[0]}`;
                splitConns.push({ ...c, flight_number: fullFn.trim(), airline: airlineCode });
              }
            });
          } else {
            splitConns.push(c);
          }
        });

        // Filter connections to only partner airlines
        const conns=splitConns.filter(c=>{
          const cp=AGREEMENTS[c.airline];
          if(!cp){ addLog(`⚠ Skipped connection ${c.airline} ${c.flight_number||"?"} — not a partner`); return false; }
          return true;
        }).map(c=>{
          const cp=AGREEMENTS[c.airline];
          const mct=AIRPORT_MCT[hr.hub_code];
          return {
            id:`c-${uid()}`,
            conn:`${cp?.name||c.airline} ${c.flight_number} → ${c.destination}`,
            fn:c.flight_number||"???",cd:c.departure_time||"??:??",ac:c.aircraft||"Unknown",at:c.arrival_time||"??:??",
            apt:c.destination||trip.destination, el:true, elL:cp?.how||"MyIDTravel",
            ov:false, airlineCode:c.airline||"??", layoverHrs:c.layover_hrs,
            mctNote:mct?.note, cabinAvail:cp?.j?"J":"Y",
          };
        });
        routes.push({
          id:`r-${uid()}`, isDirect:false, isLate:false,
          trunkCarrier:trunkCode,
          sfoFlight:`${trunkCode} ${(trunk.flight_number||"???").replace(/^[A-Z]{2}\s*/,"")}`,
          fullFlightNum:trunk.flight_number||"???",
          sfoDep:trunk.departure_time||"??:??",
          hub:hr.hub_code||"???",hubArr:`+${trunk.duration_hrs||"?"}h`,
          aircraft:trunk.aircraft||"Unknown",
          defaultJ:null, overnightHub:false,
          note:`Via ${hr.hub_name||hr.hub_code}${hr.hub_notes?` · ${hr.hub_notes}`:""}${!trunkPartner.j&&cabinJ?" · ⚠ Economy only trunk":""}`,
          cabinAvail:trunkCabin,
          isHome:trunkPartner.home||false,
          connections:conns.length>0?conns:[{id:`c-${uid()}`,conn:"No eligible connections — add manually",fn:"—",cd:"—",ac:"—",at:"—",apt:trip.destination,el:false,elL:"—",ov:false,airlineCode:"??"}],
        });
      });
      addLog(`${routes.filter(r=>!r.isDirect).length} hub routing(s) (validated)`);

      if(parsed.alt_origins?.length>0){
        addLog(`Alt origins: ${parsed.alt_origins.map(a=>`${a.airport}: ${a.note}`).join("; ")}`);
      }
      if(parsed.research_notes) addLog(`Notes: ${parsed.research_notes}`);
      addLog(`✓ ${routes.length} total route groups ready`);
      setStatus("done");
      setTimeout(()=>onDone(routes),1200);
    } catch(err){
      setError(err.message); setStatus("error"); addLog(`✗ Error: ${err.message}`);
    }
  }

  return(
    <div style={{maxWidth:480,margin:"40px auto",textAlign:"center"}}>
      <div style={{background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:16,padding:"48px 32px"}}>
        {status==="error" ? (<>
          <div style={{fontSize:40,marginBottom:16}}>✗</div>
          <div style={{fontSize:16,fontWeight:700,color:"#dc2626",marginBottom:6}}>Research Failed</div>
          <div style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>{error}</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <Btn onClick={()=>{started.current=false;setStatus("idle");setLog([]);setError(null);run();}} accent>Retry</Btn>
            <Btn onClick={onSkip} dim>Skip — add manually</Btn>
          </div>
        </>) : status==="done" ? (<>
          <div style={{fontSize:40,marginBottom:16}}>✓</div>
          <div style={{fontSize:16,fontWeight:700,color:"#059669"}}>Routes Found</div>
          <div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>Loading tracker…</div>
        </>) : (<>
          <div style={{marginBottom:24}}>
            <div style={{display:"inline-block",width:48,height:48,border:"3px solid #e5e7eb",borderTopColor:"#2563eb",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:"#111827",marginBottom:6}}>
            {trip.origin} → {trip.destination}
          </div>
          <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>
            {status==="parsing" ? "Parsing flight data…" : "Searching across partner airlines…"}
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
            {[trip.cabin==="J"?"Business class":"Economy",trip.trunkAirline?AGREEMENTS[trip.trunkAirline]?.name:"All carriers",trip.travelDate||"Flexible"].map((tag,i)=>(
              <span key={i} style={{fontSize:10,padding:"4px 10px",borderRadius:99,background:"#f3f4f6",color:"#6b7280"}}>{tag}</span>
            ))}
          </div>
        </>)}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKER
// ═══════════════════════════════════════════════════════════════════════════════
function Tracker({trip,onUpdate,onReSearch,goHome}){
  const [ud,setUd]=useState(trip.userData||{});
  const [exp,setExp]=useState({});
  const [saveMsg,setSave]=useState("");
  const [filter,setFilter]=useState("all");
  const [editMode,setEditMode]=useState(false);
  const [addingRoute,setAddingRoute]=useState(false);
  const [view,setView]=useState("routes");
  const [confirmDel,setConfirmDel]=useState(null);
  const routes=trip.routes||[];

  // Edit trip fields
  const [editName,setEditName]=useState(trip.name||"");
  const [editDate,setEditDate]=useState(trip.travelDate||"");
  const [editCabin,setEditCabin]=useState(trip.cabin||"J");
  const [editTravelers,setEditTravelers]=useState(String(trip.travelers||2));

  // Add route fields
  const [arDirect,setArDirect]=useState(true);
  const [arAirline,setArAirline]=useState("UA");
  const [arFlight,setArFlight]=useState("");
  const [arDep,setArDep]=useState("");
  const [arArr,setArArr]=useState("");
  const [arAc,setArAc]=useState("");
  const [arDest,setArDest]=useState("");
  const [arHub,setArHub]=useState("");
  const [arConnAirline,setArConnAirline]=useState("");
  const [arConnFlight,setArConnFlight]=useState("");
  const [arConnDep,setArConnDep]=useState("");
  const [arConnArr,setArConnArr]=useState("");
  const [arConnAc,setArConnAc]=useState("");
  const [arConnDest,setArConnDest]=useState("");

  const sf=(k,f,v)=>{
    const now=Date.now();
    setUd(p=>({...p,[k]:{...(p[k]||{}),[f]:v,...(f==="openSeats"||f==="listedStandby"?{[`${f}_at`]:now}:{})}}));
  };
  const doSave=async()=>{await onUpdate({userData:ud});setSave("✓");setTimeout(()=>setSave(""),2000);};
  const saveEdit=async()=>{
    await onUpdate({name:editName,travelDate:editDate,cabin:editCabin,travelers:parseInt(editTravelers)||2});
    setEditMode(false);setSave("✓ Updated");setTimeout(()=>setSave(""),2000);
  };
  const deleteRoute=async(rid)=>{
    const nr=routes.filter(r=>r.id!==rid);
    await onUpdate({routes:nr});setConfirmDel(null);setSave("Route removed");setTimeout(()=>setSave(""),2000);
  };
  const addRoute=async()=>{
    const code=arAirline;const p=AGREEMENTS[code];
    const nr={id:`r-${uid()}`,isDirect:arDirect,isLate:false,trunkCarrier:code,
      sfoFlight:`${code} ${arFlight}`,fullFlightNum:`${code} ${arFlight}`,
      sfoDep:arDep,hub:arDirect?(arDest||trip.destination):arHub,hubArr:arArr,
      aircraft:arAc||"Unknown",defaultJ:null,overnightHub:false,
      note:(arDirect?"Direct":"Via "+arHub)+" — manually added",
      cabinAvail:p?.j?"J":"Y",isHome:p?.home||false,
      connections:arDirect?[{id:`c-${uid()}`,conn:`DIRECT to ${arDest||trip.destination}`,fn:"—",cd:"—",ac:arAc||"Unknown",at:arArr,apt:arDest||trip.destination,el:!!p,elL:p?.how||"Check",ov:false,airlineCode:code,cabinAvail:p?.j?"J":"Y"}]
        :(arConnAirline?[{id:`c-${uid()}`,conn:`${AGREEMENTS[arConnAirline]?.name||arConnAirline} ${arConnFlight} → ${arConnDest||trip.destination}`,fn:`${arConnAirline} ${arConnFlight}`,cd:arConnDep,ac:arConnAc||"Unknown",at:arConnArr,apt:arConnDest||trip.destination,el:!!AGREEMENTS[arConnAirline],elL:AGREEMENTS[arConnAirline]?.how||"Check",ov:false,airlineCode:arConnAirline,cabinAvail:AGREEMENTS[arConnAirline]?.j?"J":"Y"}]:[])};
    await onUpdate({routes:[...routes,nr]});
    setAddingRoute(false);setArFlight("");setArDep("");setArArr("");setArAc("");setArDest("");setArHub("");
    setArConnAirline("");setArConnFlight("");setArConnDep("");setArConnArr("");setArConnAc("");setArConnDest("");
    setSave("Route added");setTimeout(()=>setSave(""),2000);
  };

  const getOpen=useCallback((rid,def)=>{const v=ud[rid]?.openSeats;if(v!==undefined&&v!==null&&v!==""){const n=parseInt(v,10);return isNaN(n)?def:Math.max(0,n);}return def;},[ud]);
  const getListed=useCallback((rid)=>{const v=ud[rid]?.listedStandby;return(v!==undefined&&v!==null)?v:"";},[ud]);
  const enriched=useMemo(()=>{
    return routes.map(r=>{
      const open=getOpen(r.id,r.defaultJ);const listed=getListed(r.id);
      const rem=getRemaining(open,listed);const tier=calcTier(r.isDirect,r.isLate,rem,open);
      return {...r,open,listed,remaining:rem,tier};
    }).sort((a,b)=>{
      if(a.tier!==b.tier)return a.tier-b.tier;
      if(a.isDirect!==b.isDirect)return a.isDirect?-1:1;
      if((a.isHome||false)!==(b.isHome||false))return a.isHome?-1:1;
      return(b.remaining??b.open)-(a.remaining??a.open);
    });
  },[routes,getOpen,getListed]);
  const filtered=view==="checklist"?enriched:filter==="all"?enriched:enriched.filter(r=>{
    if(filter==="priority")return r.tier===1;if(filter==="good")return r.tier<=2;return r.tier<=3;
  });
  const remColor=(r)=>r===null?"#d1d5db":r>=5?"#059669":r>=2?"#2563eb":r>=0?"#d97706":"#dc2626";
  const clearMsg=(open,listed)=>{
    const r=getRemaining(open,listed);const tv=trip.travelers||2;
    if(open===null||open===undefined)return null;
    if(open===0)return{label:"✗ No seats",c:"#dc2626"};if(r===null)return null;
    if(r>=tv)return{label:`✓ ${tv>1?"Both":"You"} likely clear`,c:"#059669"};
    if(r>=1&&tv>=2)return{label:"⚠ One seat — split risk",c:"#d97706"};
    if(r===0)return{label:"⚠ Need 1+ no-show",c:"#d97706"};
    return{label:`✗ Need ${Math.abs(r)+tv} no-shows`,c:"#dc2626"};
  };
  const getDeadlineInfo=(ac)=>{const rules=AIRLINE_RULES[ac];if(!rules)return{label:"Check myIDTravel",urgency:"low"};if(rules.listingAlert==="red")return{label:rules.listingLabel,urgency:"high"};if(rules.listingAlert==="amber")return{label:rules.listingLabel,urgency:"medium"};return{label:rules.listingLabel,urgency:"low"};};
  const travelDate=trip.travelDate?new Date(trip.travelDate+"T00:00:00"):null;
  const daysUntil=travelDate?Math.ceil((travelDate-new Date())/(86400000)):null;

  return(<div>
    {/* Header */}
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
      <div style={{flex:1}}>
        {editMode?(<div style={{display:"flex",flexDirection:"column",gap:8}}>
          <input value={editName} onChange={e=>setEditName(e.target.value)} style={{...INP,fontSize:16,fontWeight:700,maxWidth:300}} placeholder="Trip name"/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{...INP,width:160}}/>
            <select value={editCabin} onChange={e=>setEditCabin(e.target.value)} style={{...INP,width:130,appearance:"auto"}}><option value="J">Business (J)</option><option value="Y">Economy (Y)</option></select>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:11,color:"#9ca3af"}}>Pax:</span><input type="number" min="1" max="9" value={editTravelers} onChange={e=>setEditTravelers(e.target.value)} style={{...INP,width:50,textAlign:"center"}}/></div>
            <Btn onClick={saveEdit} accent>Save Changes</Btn><Btn onClick={()=>setEditMode(false)} dim>Cancel</Btn>
          </div>
        </div>):(<>
          <div style={{fontSize:10,color:"#9ca3af",fontFamily:"monospace",marginBottom:4}}>
            {trip.travelDate||"Flex"}{trip.flexDays>0?` (±${trip.flexDays}d)`:""} · {trip.cabin==="J"?"Business":"Economy"} · {trip.travelers} pax{trip.trunkAirline?` · Trunk: ${AGREEMENTS[trip.trunkAirline]?.name||trip.trunkAirline} only`:""}
            {daysUntil!==null&&<span style={{marginLeft:8,fontWeight:700,color:daysUntil<=3?"#dc2626":daysUntil<=7?"#d97706":"#059669"}}>{daysUntil<=0?"TODAY / PAST":`${daysUntil}d away`}</span>}
          </div>
          <h2 style={{fontSize:24,fontWeight:900,color:"#111827",margin:"0 0 2px"}}>{trip.origin} → {trip.destination}</h2>
          <p style={{fontSize:12,color:"#9ca3af",margin:0}}>{trip.name}</p>
        </>)}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {saveMsg&&<span style={{fontSize:11,color:"#059669",fontFamily:"monospace"}}>{saveMsg}</span>}
        <Btn onClick={doSave} accent>SAVE</Btn>
        {!editMode&&<Btn onClick={()=>setEditMode(true)} dim>Edit Trip</Btn>}
        <Btn onClick={onReSearch} dim>Re-research</Btn>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:"1px solid #e5e7eb",paddingBottom:10}}>
      <Btn onClick={()=>setView("routes")} active={view==="routes"}>Routes ({routes.length})</Btn>
      <Btn onClick={()=>setView("checklist")} active={view==="checklist"}>Day-of Checklist</Btn>
      <div style={{flex:1}}/><Btn onClick={()=>setAddingRoute(true)} accent>+ Add Route</Btn>
    </div>

    {/* ═══ ADD ROUTE ═══ */}
    {addingRoute&&(<div style={{background:"#fff",border:"1.5px solid #2563eb",borderRadius:12,padding:"18px 20px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>Add Route Manually</span>
        <Btn onClick={()=>setAddingRoute(false)} dim>✕</Btn>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}><Btn onClick={()=>setArDirect(true)} active={arDirect}>Direct</Btn><Btn onClick={()=>setArDirect(false)} active={!arDirect}>Via Hub</Btn></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:12}}>
        <FG label="Trunk Airline"><select value={arAirline} onChange={e=>setArAirline(e.target.value)} style={{...INP,appearance:"auto"}}>{Object.entries(AGREEMENTS).map(([c,a])=><option key={c} value={c}>{c} — {a.name}</option>)}</select></FG>
        <FG label="Flight #"><input value={arFlight} onChange={e=>setArFlight(e.target.value)} placeholder="837" style={INP}/></FG>
        <FG label="Departs"><input value={arDep} onChange={e=>setArDep(e.target.value)} placeholder="11:40" style={INP}/></FG>
        <FG label="Arrives"><input value={arArr} onChange={e=>setArArr(e.target.value)} placeholder="15:00+1" style={INP}/></FG>
        <FG label="Aircraft"><input value={arAc} onChange={e=>setArAc(e.target.value)} placeholder="B777" style={INP}/></FG>
        {arDirect?<FG label="Dest Airport"><input value={arDest} onChange={e=>setArDest(e.target.value.toUpperCase())} placeholder="NRT" maxLength={3} style={INP}/></FG>
                 :<FG label="Hub Airport"><input value={arHub} onChange={e=>setArHub(e.target.value.toUpperCase())} placeholder="ICN" maxLength={3} style={INP}/></FG>}
      </div>
      {!arDirect&&<div style={{borderTop:"1px solid #e5e7eb",paddingTop:10,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",marginBottom:8}}>CONNECTION FROM HUB</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
          <FG label="Airline"><select value={arConnAirline} onChange={e=>setArConnAirline(e.target.value)} style={{...INP,appearance:"auto"}}><option value="">Select…</option>{Object.entries(AGREEMENTS).map(([c,a])=><option key={c} value={c}>{c} — {a.name}</option>)}</select></FG>
          <FG label="Flight #"><input value={arConnFlight} onChange={e=>setArConnFlight(e.target.value)} placeholder="705" style={INP}/></FG>
          <FG label="Dep Hub"><input value={arConnDep} onChange={e=>setArConnDep(e.target.value)} placeholder="18:35" style={INP}/></FG>
          <FG label="Arrives"><input value={arConnArr} onChange={e=>setArConnArr(e.target.value)} placeholder="21:05" style={INP}/></FG>
          <FG label="Aircraft"><input value={arConnAc} onChange={e=>setArConnAc(e.target.value)} placeholder="B787" style={INP}/></FG>
          <FG label="Dest"><input value={arConnDest} onChange={e=>setArConnDest(e.target.value.toUpperCase())} placeholder="NRT" maxLength={3} style={INP}/></FG>
        </div>
      </div>}
      <Btn onClick={addRoute} accent disabled={!arFlight}>Add Route</Btn>
    </div>)}

    {/* ═══ CHECKLIST ═══ */}
    {view==="checklist"&&(<div>
      {daysUntil!==null&&<div style={{padding:"12px 16px",background:daysUntil<=1?"#fef2f2":daysUntil<=3?"#fffbeb":"#f0fdf4",border:"1px solid "+(daysUntil<=1?"#fca5a5":daysUntil<=3?"#fcd34d":"#86efac"),borderRadius:10,marginBottom:14,fontSize:13,fontWeight:600,color:daysUntil<=1?"#991b1b":daysUntil<=3?"#78350f":"#065f46"}}>{daysUntil<=0?"⚠ Travel day is today or has passed!":daysUntil===1?"⚠ Travel is TOMORROW!":`Travel in ${daysUntil} days — ${trip.travelDate}`}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {enriched.map(r=>{const a=AGREEMENTS[r.trunkCarrier];const dl=getDeadlineInfo(r.trunkCarrier);const seatTs=ud[r.id]?.openSeats_at;
          return(<div key={r.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:800,color:"#111827"}}>{r.fullFlightNum}</span>
                <span style={{fontSize:11,color:"#6b7280"}}>{a?.name}</span>
                {r.isDirect&&<span style={{fontSize:9,background:"#111827",color:"#fff",padding:"1px 6px",borderRadius:99,fontWeight:700}}>DIRECT</span>}
              </div>
              <span style={{fontSize:10,padding:"3px 10px",borderRadius:99,background:dl.urgency==="high"?"#fee2e2":dl.urgency==="medium"?"#fef3c7":"#d1fae5",color:dl.urgency==="high"?"#991b1b":dl.urgency==="medium"?"#78350f":"#065f46",fontWeight:600}}>{dl.label}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,fontSize:11}}>
              <div><span style={{color:"#9ca3af"}}>Listing: </span><span style={{color:dl.urgency==="high"?"#dc2626":"#374151",fontWeight:600}}>{dl.label}</span></div>
              <div><span style={{color:"#9ca3af"}}>Check-in: </span><span style={{color:"#374151"}}>{AIRLINE_RULES[r.trunkCarrier]?.checkIn?.slice(0,80)||"Standard — check airline"}</span></div>
              <div><span style={{color:"#9ca3af"}}>Dress code: </span><span style={{color:"#374151"}}>{AIRLINE_RULES[r.trunkCarrier]?.dress?.slice(0,80)||"Smart casual"}</span></div>
              <div><span style={{color:"#9ca3af"}}>Seats updated: </span><span style={{color:seatTs?"#374151":"#d1d5db"}}>{seatTs?new Date(seatTs).toLocaleString():"Not yet"}</span></div>
            </div>
            {!r.isDirect&&r.connections.filter(c=>c.airlineCode!=="??").length>0&&(
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0f0"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",marginBottom:4}}>CONNECTION REMINDERS</div>
                {sortConnections(r.connections).filter(c=>c.airlineCode!=="??").slice(0,3).map(c=>{const cdl=getDeadlineInfo(c.airlineCode);
                  return(<div key={c.id} style={{fontSize:11,display:"flex",gap:12,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,color:"#374151",minWidth:80}}>{c.fn}</span>
                    <span style={{color:cdl.urgency==="high"?"#dc2626":"#6b7280"}}>{cdl.label}</span>
                    <span style={{color:"#9ca3af"}}>{AIRLINE_RULES[c.airlineCode]?.dress?.slice(0,50)||"Smart casual"}</span>
                  </div>);})}
              </div>
            )}
          </div>);})}
      </div>
    </div>)}

    {/* ═══ ROUTES ═══ */}
    {view==="routes"&&(<>
      {enriched.filter(r=>r.open===null||r.open>0).length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,fontWeight:700,color:"#9ca3af",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>Top options</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
            {enriched.filter(r=>r.open===null||r.open>0).slice(0,4).map((r,i)=>{const tm=TIER_META[r.tier];const a=AGREEMENTS[r.trunkCarrier];
              return(<div key={r.id} style={{background:tm.bg,border:`1.5px solid ${tm.border}`,borderRadius:10,padding:"11px 13px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:22,fontWeight:900,color:tm.accent}}>#{i+1}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,background:tm.badge,color:tm.badgeText}}>{tm.label}</span>
                  {r.cabinAvail==="J"&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:99,background:"#fef3c7",color:"#92400e",fontWeight:700}}>J</span>}
                  {r.isHome&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:99,background:"#d1fae5",color:"#065f46",fontWeight:700}}>HOME ★</span>}
                </div>
                <div style={{fontSize:14,fontWeight:800,color:"#111827",marginBottom:2}}>{r.fullFlightNum}</div>
                <div style={{fontSize:10,color:"#6b7280"}}>{a?.name||r.trunkCarrier} · {trip.origin}→{r.hub}{r.isDirect&&<span style={{marginLeft:4,fontSize:9,background:"#111827",color:"#fff",padding:"0 5px",borderRadius:99,fontWeight:700}}>DIRECT</span>}</div>
                <div style={{fontSize:13,fontWeight:900,color:remColor(r.remaining),marginTop:4}}>{r.open===null?"Enter seats →":r.remaining!==null?`${r.remaining} remaining`:`${r.open} open`}</div>
              </div>);})}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[{v:"all",l:"All"},{v:"priority",l:"⭐ Priority"},{v:"good",l:"✓ Good+"},{v:"backup",l:"△ Backup+"}].map(f=>(<Btn key={f.v} onClick={()=>setFilter(f.v)} active={filter===f.v}>{f.l}</Btn>))}
        <span style={{fontSize:10,color:"#9ca3af",fontFamily:"monospace",marginLeft:6}}>{filtered.length}/{routes.length}</span>
      </div>
      {filtered.length===0?(<div style={{textAlign:"center",padding:"40px",background:"#fff",borderRadius:12,border:"1px solid #e5e7eb"}}><div style={{color:"#6b7280"}}>No routes match filter.</div></div>):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map((r,ri)=>{const tm=TIER_META[r.tier];const cm=clearMsg(r.open,r.listed);const a=AGREEMENTS[r.trunkCarrier];const seatTs=ud[r.id]?.openSeats_at;
            return(<div key={r.id} style={{borderRadius:12,overflow:"hidden",border:`1.5px solid ${tm.border}`,opacity:r.open===0?.4:1}}>
              <div style={{background:tm.bg,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12,borderBottom:`1px solid ${tm.border}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:70}}>
                    <span style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>#{ri+1}</span>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99,background:tm.badge,color:tm.badgeText,whiteSpace:"nowrap"}}>{tm.label}</span>
                    {r.cabinAvail==="J"&&<span style={{fontSize:8,color:"#d97706",fontFamily:"monospace"}}>J avail</span>}
                    {r.isHome&&<span style={{fontSize:8,color:"#065f46",fontWeight:700}}>HOME ★</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:18,fontWeight:900,color:"#111827"}}>{r.fullFlightNum}</span>
                      <span style={{fontSize:11,color:"#9ca3af",fontFamily:"monospace"}}>{a?.name||r.trunkCarrier}</span>
                      {a?.alliance&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:"#f3f4f6",color:"#6b7280"}}>{a.alliance}</span>}
                      <span style={{fontSize:10,background:"#f3f4f6",color:"#6b7280",padding:"1px 7px",borderRadius:99,fontFamily:"monospace"}}>{r.aircraft}</span>
                      {r.isDirect&&<span style={{fontSize:10,background:"#111827",color:"#fff",padding:"1px 8px",borderRadius:99,fontWeight:700}}>DIRECT</span>}
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af"}}>{trip.origin} → <strong style={{color:"#6b7280"}}>{r.hub}</strong> · Dep <span style={{fontFamily:"monospace",color:"#6b7280"}}>{r.sfoDep}</span> · Arr <span style={{fontFamily:"monospace",color:"#6b7280"}}>{r.hubArr}</span></div>
                    {r.note&&<div style={{fontSize:11,color:"#9ca3af",marginTop:2,fontStyle:"italic"}}>{r.note}</div>}
                    {seatTs&&<div style={{fontSize:9,color:"#d1d5db",marginTop:2}}>Seats updated {new Date(seatTs).toLocaleString()}</div>}
                  </div>
                </div>
                <div style={{background:"#fff",border:`1.5px solid ${tm.border}`,borderRadius:10,padding:"12px 14px",width:"100%",boxSizing:"border-box"}}>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:4,fontFamily:"monospace"}}>{trip.cabin==="J"?"Open J":"Open Y"}</div>
                      <input type="number" min="0" max="99" value={ud[r.id]?.openSeats??""} placeholder="?" onChange={e=>sf(r.id,"openSeats",e.target.value)} style={{width:"100%",fontSize:20,fontWeight:900,textAlign:"center",background:"transparent",border:"none",borderBottom:`2px solid ${tm.border}`,outline:"none",color:r.open!==null?remColor(r.remaining):"#9ca3af",fontFamily:"inherit",padding:"0 0 2px"}}/></div>
                    <div style={{paddingTop:18,color:"#d1d5db"}}>−</div>
                    <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:4,fontFamily:"monospace"}}>Listed</div>
                      <input type="number" min="0" max="99" value={r.listed} onChange={e=>sf(r.id,"listedStandby",e.target.value)} placeholder="?" style={{width:"100%",fontSize:20,fontWeight:900,textAlign:"center",background:"transparent",border:"none",borderBottom:"2px solid #d4d4d8",outline:"none",color:"#6b7280",fontFamily:"inherit",padding:"0 0 2px"}}/></div>
                    <div style={{paddingTop:18,color:"#d1d5db"}}>=</div>
                    <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:4,fontFamily:"monospace"}}>Left</div>
                      <div style={{fontSize:20,fontWeight:900,color:remColor(r.remaining),minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}>{r.remaining!==null?r.remaining:"?"}</div></div>
                  </div>
                  {cm&&<div style={{fontSize:11,fontWeight:600,color:cm.c,textAlign:"center",paddingTop:6,borderTop:"1px solid #e5e7eb"}}>{cm.label}</div>}
                  {!cm&&<div style={{fontSize:10,color:"#9ca3af",textAlign:"center",fontStyle:"italic",paddingTop:6,borderTop:"1px solid #e5e7eb"}}>{r.open===null?"← Enter open seats":"← Enter listed count"}</div>}
                </div>
              </div>
              {r.isDirect?(
                <div style={{background:"#fff",padding:"10px 18px",display:"flex",alignItems:"center",flexWrap:"wrap",gap:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#2563eb"}}>{r.connections[0]?.at}</span>
                  <span style={{fontSize:10,color:"#059669",fontWeight:600}}>✓ {a?.how||"MyIDTravel"}</span>
                  <span style={{fontSize:10,color:"#9ca3af"}}>{r.connections[0]?.apt}</span>
                  <Btn onClick={()=>setExp(p=>({...p,[r.id+"_rules"]:!p[r.id+"_rules"]}))} dim>{exp[r.id+"_rules"]?"▲":"ⓘ Rules"}</Btn>
                  <div style={{flex:1}}/>
                  {confirmDel===r.id?(<><Btn onClick={()=>setConfirmDel(null)} dim>Cancel</Btn><button onClick={()=>deleteRoute(r.id)} style={{fontSize:10,color:"#fff",background:"#dc2626",border:"none",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>Confirm Delete</button></>):(<button onClick={()=>setConfirmDel(r.id)} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer"}}>Remove</button>)}
                  {exp[r.id+"_rules"]&&<div style={{width:"100%",marginTop:4}}><AirlinePanel code={r.trunkCarrier}/></div>}
                </div>
              ):(
                <div style={{background:"#fff",overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{borderBottom:"1px solid #e5e7eb"}}>
                      {["Connection","Flt","Dep","Aircraft","Arrives","Apt","Cabin","Eligible","Rules","Ticket #","Notes"].map(c=>(<th key={c} style={{padding:"7px 10px",textAlign:"left",fontSize:9,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"#9ca3af",whiteSpace:"nowrap"}}>{c}</th>))}
                    </tr></thead>
                    <tbody>
                      {sortConnections(r.connections).map((c,ci)=>{const cu=ud[c.id]||{};const ar=AGREEMENTS[c.airlineCode];const isExp=!!exp[c.id];
                        return(<>
                          <tr key={c.id} style={{background:ci%2===0?"#fff":"#f9fafb",borderBottom:isExp?"none":"1px solid #f0f0f0"}}>
                            <td style={{padding:"8px 10px",fontWeight:500,color:"#374151",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.conn}{c.layoverHrs&&<span style={{marginLeft:4,fontSize:9,color:"#9ca3af"}}>({c.layoverHrs}h)</span>}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",color:"#6b7280"}}>{c.fn}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",color:"#6b7280"}}>{c.cd}</td>
                            <td style={{padding:"8px 10px",color:"#9ca3af"}}>{c.ac}</td>
                            <td style={{padding:"8px 10px",fontWeight:700,color:"#2563eb"}}>{c.at}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",color:"#6b7280"}}>{c.apt}</td>
                            <td style={{padding:"8px 10px"}}><span style={{fontSize:9,padding:"1px 5px",borderRadius:99,background:c.cabinAvail==="J"?"#fef3c7":"#f3f4f6",color:c.cabinAvail==="J"?"#92400e":"#6b7280",fontWeight:600}}>{c.cabinAvail==="J"?"J":"Y"}</span></td>
                            <td style={{padding:"8px 10px"}}>{c.el?<span style={{color:"#059669",fontWeight:600}}>✓</span>:<span style={{color:"#dc2626"}}>✗</span>}</td>
                            <td style={{padding:"8px 10px"}}>{ar&&<Btn onClick={()=>setExp(p=>({...p,[c.id]:!p[c.id]}))} dim>{isExp?"▲":"ⓘ"}</Btn>}</td>
                            <td style={{padding:"8px 10px",minWidth:100}}><input value={cu.ticket||""} onChange={e=>sf(c.id,"ticket",e.target.value)} placeholder="Conf#" style={{width:"100%",fontSize:10,border:"none",borderBottom:"1px solid #e5e7eb",background:"transparent",outline:"none",color:"#374151",padding:"2px 0"}}/></td>
                            <td style={{padding:"8px 10px",minWidth:120}}><input value={cu.notes||""} onChange={e=>sf(c.id,"notes",e.target.value)} placeholder="Notes…" style={{width:"100%",fontSize:10,border:"none",borderBottom:"1px solid #e5e7eb",background:"transparent",outline:"none",color:"#374151",padding:"2px 0"}}/></td>
                          </tr>
                          {isExp&&<tr key={c.id+"-r"} style={{borderBottom:"1px solid #f0f0f0"}}><td colSpan={11} style={{padding:"0 10px 10px"}}>
                            {c.mctNote&&<div style={{marginBottom:6,padding:"5px 10px",background:"#f0f4ff",border:"1px solid #bfdbfe",borderRadius:7,fontSize:11,color:"#2563eb"}}>MCT: {c.mctNote}</div>}
                            <AirlinePanel code={c.airlineCode}/>
                          </td></tr>}
                        </>);})}
                    </tbody>
                  </table>
                  <div style={{padding:"6px 18px",borderTop:"1px solid #f0f0f0",display:"flex",justifyContent:"flex-end"}}>
                    {confirmDel===r.id?(<div style={{display:"flex",gap:6}}><Btn onClick={()=>setConfirmDel(null)} dim>Cancel</Btn><button onClick={()=>deleteRoute(r.id)} style={{fontSize:10,color:"#fff",background:"#dc2626",border:"none",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>Confirm Delete</button></div>):(<button onClick={()=>setConfirmDel(r.id)} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer"}}>Remove route</button>)}
                  </div>
                </div>
              )}
            </div>);})}
        </div>
      )}
    </>)}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIRLINE RULES REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════
function Rules(){
  const [search,setSearch]=useState("");
  const [exp,setExp]=useState({});
  const [tab,setTab]=useState("all");
  const codes=Object.keys(AGREEMENTS).filter(c=>{
    if(tab==="j"&&!AGREEMENTS[c].j)return false;
    if(tab==="y"&&AGREEMENTS[c].j)return false;
    if(!search)return true;
    const s=search.toLowerCase();
    return c.toLowerCase().includes(s)||AGREEMENTS[c].name.toLowerCase().includes(s)||(AGREEMENTS[c].alliance||"").toLowerCase().includes(s);
  }).sort((a,b)=>AGREEMENTS[a].name.localeCompare(AGREEMENTS[b].name));

  return(<div>
    <h2 style={{fontSize:22,fontWeight:800,color:"#111827",marginBottom:4}}>Airline Agreement Reference</h2>
    <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>{J_PARTNERS.length} business class · {Y_PARTNERS.length-J_PARTNERS.length} economy-only · {Y_PARTNERS.length} total</p>
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search airline…" style={{...INP,maxWidth:300}}/>
      {[{v:"all",l:`All (${Y_PARTNERS.length})`},{v:"j",l:`Business (${J_PARTNERS.length})`},{v:"y",l:`Economy only (${Y_PARTNERS.length-J_PARTNERS.length})`}].map(f=>(
        <Btn key={f.v} onClick={()=>setTab(f.v)} active={tab===f.v}>{f.l}</Btn>
      ))}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {codes.map(code=>{
        const ar=AGREEMENTS[code]; const isExp=!!exp[code];
        return(<div key={code} style={{background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden"}}>
          <div onClick={()=>setExp(p=>({...p,[code]:!p[code]}))} style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:16,fontWeight:900,color:"#111827",fontFamily:"monospace",minWidth:28}}>{code}</span>
              <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{ar.name}</span>
              <span style={{fontSize:9,padding:"2px 8px",borderRadius:99,background:ar.j?"#fef3c7":"#f3f4f6",color:ar.j?"#92400e":"#6b7280",fontWeight:700}}>{ar.j?"J + Y":"Y only"}</span>
              {ar.alliance&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:"#f3f4f6",color:"#9ca3af"}}>{ar.alliance}</span>}
            </div>
            <span style={{color:"#d1d5db"}}>{isExp?"▲":"▼"}</span>
          </div>
          {isExp&&<div style={{padding:"0 16px 16px"}}><AirlinePanel code={code}/></div>}
        </div>);
      })}
    </div>
  </div>);
}

function AirlinePanel({code}){
  const ar=AGREEMENTS[code];
  if(!ar)return <div style={{fontSize:11,color:"#9ca3af"}}>No data for "{code}".</div>;
  const full=AIRLINE_RULES[code];
  return(
    <div style={{background:"#f5f4f0",border:"1px solid #e5e7eb",borderRadius:9,padding:"12px 14px",fontSize:11}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:"#111827"}}>{ar.name} ({code})</span>
        <span style={{fontSize:9,padding:"2px 8px",borderRadius:99,background:ar.j?"#fef3c7":"#f3f4f6",color:ar.j?"#92400e":"#6b7280",fontWeight:700}}>{ar.j?"Business + Economy":"Economy only"}</span>
        {ar.alliance&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:"#f3f4f6",color:"#9ca3af"}}>{ar.alliance}</span>}
      </div>
      {full?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          <RI label="How to List" text={full.listingFull} alert={full.listingAlert}/>
          <RI label="Check-In" text={full.checkIn} extra={full.checkInApp?`📱 ${full.checkInApp}`:null}/>
          <RI label="Dress Code" text={full.dress}/>
          <RI label="⚠ Warnings" text={full.warning} warn footer={full.exclusions?`Excluded: ${full.exclusions}`:null}/>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          <RI label="How to Buy" text={ar.how}/>
          <RI label="How to List" text={ar.list}/>
          <RI label="Agreement" text={ar.j?"Business class ZED agreement available. Check myIDTravel or see the agreement document for full rules.":"Economy-only ZED agreement. Book via myIDTravel. Check flyzed.info for detailed rules."}/>
          <RI label="Tip" text="Check flyzed.info for this airline's specific dress code, listing deadlines, and exclusions."/>
        </div>
      )}
    </div>
  );
}

function RI({label,text,extra,warn,footer,alert}){
  const als=alert?ALERT_STYLE[alert]:null;
  return(<div>
    <div style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4,fontFamily:"monospace"}}>{label}</div>
    {als?<div style={{fontSize:11,color:als.color,lineHeight:1.55,padding:"4px 8px",borderRadius:6,background:als.bg,border:`1px solid ${als.border}`}}>{text}</div>
      :<div style={{fontSize:11,color:warn?"#f87171":"#aaa",lineHeight:1.55}}>{text}</div>}
    {extra&&<div style={{fontSize:10,color:"#2563eb",marginTop:3}}>{extra}</div>}
    {footer&&<div style={{fontSize:10,color:"#9ca3af",marginTop:4,fontStyle:"italic"}}>{footer}</div>}
  </div>);
  }