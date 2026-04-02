// netlify/functions/research-background.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY, 
  authDomain: "standby-planner.firebaseapp.com",
  databaseURL: "https://standby-planner-default-rtdb.firebaseio.com",
  projectId: "standby-planner",
  storageBucket: "standby-planner.appspot.com",
  messagingSenderId: "783265538352",
  appId: "1:783265538352:web:69cd6e8603bc8aae89ec3c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const handler = async (event) => {
  const { prompt, userId } = JSON.parse(event.body);

  // UPDATED: Priority check for the variable name in your dashboard
  const key = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;

  try {
    console.log(`Research started for: ${userId}`);
    
    // Safety check to log if the key is missing before trying to use it
    if (!key) {
      console.error("CRITICAL ERROR: No Anthropic key found in environment variables (VITE_ANTHROPIC_KEY).");
      throw new Error("Missing API Key");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "token-efficient-tools-2025-02-19"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", 
        max_tokens: 4000,
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!data.content) {
      console.error("Claude API Error Detail:", data.error || data);
      throw new Error(data.error?.message || "API returned no content");
    }

    const text = data.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    await setDoc(doc(db, "research", userId), {
      results: text,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("SUCCESS: Results saved to Firebase.");

  } catch (error) {
    console.error("Background Process Error:", error.message);
    await setDoc(doc(db, "research", userId), {
      status: "error",
      error: error.message
    });
  }
};