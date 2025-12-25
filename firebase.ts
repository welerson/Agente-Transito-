
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDJhjsrAVo32QYnkCnBSRzrrj5ElVpi8rU",
  authDomain: "app-multas-gcmbh.firebaseapp.com",
  projectId: "app-multas-gcmbh",
  storageBucket: "app-multas-gcmbh.firebasestorage.app",
  messagingSenderId: "518441730400",
  appId: "1:518441730400:web:5c77a71ae3e0bd5efc1e05"
};

// Singleton para garantir que o app só seja inicializado uma vez com a mesma instância
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Ativa persistência offline de forma assíncrona para não bloquear o carregamento do Firestore
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiplas abas abertas, a persistência só funciona em uma por vez
      console.warn('Persistência offline: Múltiplas abas detectadas.');
    } else if (err.code === 'unimplemented') {
      // O navegador não suporta (ex: modo incógnito)
      console.warn('Persistência offline: Navegador sem suporte.');
    } else {
      console.error('Erro na persistência offline:', err);
    }
  });
}

export { app, db, auth };
