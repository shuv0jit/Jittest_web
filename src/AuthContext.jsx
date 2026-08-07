/* eslint-disable no-unused-vars */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();
const ADMIN_EMAIL = "admin@jittest.com";

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [testerData, setTesterData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        try {
          // 1. Check if user has role='admin' in the database
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setTesterData(data); // Store full tester data
            setRole(data.role === 'admin' ? 'admin' : 'tester');
          } else if (user.email === ADMIN_EMAIL) {
            // Fallback for admin if not in DB
            setRole('admin');
          } else {
            setRole('tester');
          }
        } catch (error) {
          setRole(user.email === ADMIN_EMAIL ? 'admin' : 'tester');
        }
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, role, loading, testerData, loginEmail, loginGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};