// netlify/functions/research-background.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase config (Copy from your firebase-storage.js)
const firebaseConfig = {
  apiKey: "AIzaSyCEU4w5t0BmOqAodkiv0YHqvmbxbvXsoKI",
  authDomain: "standby-planner.firebaseapp.com",
  databaseURL: "https://standby-planner-default-rtdb.firebaseio.com",
  projectId: "standby-planner",
  storageBucket: "standby-planner.firebasestorage.app",
  messagingSenderId: "777289444892",
  appId: "1:777289444892:web:458237c2c6db002eeef9d9"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const handler = async (event) => {
  const { prompt, engine, userId } = JSON.parse(event.body);
  const key = engine === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.GOOGLE_API_KEY;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "token-efficient-tools-2025-02-19"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // Validated 2026 Model
        max_tokens: 4000,
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");

    // SAVE TO FIREBASE: This is how App.jsx will get the result
    await setDoc(doc(db, "research", userId), {
      results: text,
      timestamp: new Date().toISOString(),
      status: "complete"
    });

    console.log("Research saved to Firebase successfully.");
  } catch (error) {
    console.error("Background Task Failed:", error.message);
  }
};