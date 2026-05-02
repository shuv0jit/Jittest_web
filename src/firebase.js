import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvvYmcpWxAPoyK02ovACkoxCh9Xzb5WHs",
  authDomain: "jittest-f1580.firebaseapp.com",
  projectId: "jittest-f1580",
  storageBucket: "jittest-f1580.firebasestorage.app",
  messagingSenderId: "261487978801",
  appId: "1:261487978801:web:72c94d4f0fb1f3691de810",
  measurementId: "G-9FW44JEN5S"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);