
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
// Correctly import getAuth from the modular auth package
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDJhjsrAVo32QYnkCnBSRzrrj5ElVpi8rU",
  authDomain: "app-multas-gcmbh.firebaseapp.com",
  projectId: "app-multas-gcmbh",
  storageBucket: "app-multas-gcmbh.firebasestorage.app",
  messagingSenderId: "518441730400",
  appId: "1:518441730400:web:5c77a71ae3e0bd5efc1e05"
};

// Ensure app is initialized exactly once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get services using modular SDK pattern
const db = getFirestore(app);
const auth = getAuth(app);

// Attempt persistence offline if in a browser context
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: Multiple tabs open, only one can be offline-enabled.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: Browser does not support indexedDB.');
    } else {
      console.error('Firestore persistence error:', err);
    }
  });
}

export { app, db, auth };
