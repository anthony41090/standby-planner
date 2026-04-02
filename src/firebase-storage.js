// ═══════════════════════════════════════════════════════════════════════════════
// firebase-storage.js
// Drop-in replacement for window.storage using Firebase Realtime Database
// Add this file to your Netlify project's src/ folder
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, remove } from "firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// ─── YOUR Firebase Config ────────────────────────────────────────────────────
// Replace these values with your project's config from Firebase Console
// (See setup guide for where to find these)
const firebaseConfig = {
  apiKey: "AIzaSyCEU4w5t0BmOqAodkiv0YHqvmbxbvXsoKI",
  authDomain: "standby-planner.firebaseapp.com",
  databaseURL: "https://standby-planner-default-rtdb.firebaseio.com",
  projectId: "standby-planner",
  storageBucket: "standby-planner.firebasestorage.app",
  messagingSenderId: "777289444892",
  appId: "1:777289444892:web:458237c2c6db002eeef9d9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ─── Auth helpers ────────────────────────────────────────────────────────────
let currentUserId = null;

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUserId = user?.uid || null;
    callback(user);
  });
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  currentUserId = cred.user.uid;
  return cred.user;
}

export async function signup(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  currentUserId = cred.user.uid;
  return cred.user;
}

export async function logout() {
  await signOut(auth);
  currentUserId = null;
}

// ─── Storage adapter (same interface as window.storage) ──────────────────────
function userRef(key) {
  if (!currentUserId) throw new Error("Not authenticated");
  // Sanitize key for Firebase path (no dots, brackets, etc.)
  const safeKey = key.replace(/[.#$\[\]]/g, "_");
  return ref(db, `users/${currentUserId}/${safeKey}`);
}

export const firebaseStorage = {
  async get(key) {
    try {
      const snapshot = await get(userRef(key));
      if (snapshot.exists()) {
        return { key, value: snapshot.val() };
      }
      return null;
    } catch (err) {
      console.error("Firebase get error:", err);
      return null;
    }
  },

  async set(key, value) {
    try {
      await set(userRef(key), value);
      return { key, value };
    } catch (err) {
      console.error("Firebase set error:", err);
      return null;
    }
  },

  async delete(key) {
    try {
      await remove(userRef(key));
      return { key, deleted: true };
    } catch (err) {
      console.error("Firebase delete error:", err);
      return null;
    }
  },
};
