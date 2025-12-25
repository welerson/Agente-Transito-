
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * CONFIGURAÇÃO DO FIREBASE (PRODUÇÃO)
 */
const firebaseConfig = {
  apiKey: "AIzaSyDJhjsrAVo32QYnkCnBSRzrrj5ElVpi8rU",
  authDomain: "app-multas-gcmbh.firebaseapp.com",
  projectId: "app-multas-gcmbh",
  storageBucket: "app-multas-gcmbh.firebasestorage.app",
  messagingSenderId: "518441730400",
  appId: "1:518441730400:web:5c77a71ae3e0bd5efc1e05"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Ativa persistência offline para funcionamento PWA (IndexedDB)
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistência falhou: Múltiplas abas abertas simultaneamente.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistência falhou: O navegador atual não suporta armazenamento offline.');
    }
  });
}

export { app, db, auth };
