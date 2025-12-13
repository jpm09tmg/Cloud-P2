"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { useRouter } from "next/navigation";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // During static export / non-browser env, auth can be null
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  const requireAuth = () => {
    if (!auth) {
      throw new Error(
        "Firebase auth is not initialized. Check NEXT_PUBLIC_FIREBASE_* env vars and client-only execution."
      );
    }
    return auth;
  };

  const createAccount = async (email, password, username) => {
    const a = requireAuth();
    const result = await createUserWithEmailAndPassword(a, email, password);

    await updateProfile(result.user, { displayName: username });
    return result.user;
  };

  const emailSignIn = async (email, password) => {
    const a = requireAuth();
    return await signInWithEmailAndPassword(a, email, password);
  };

  const gitHubSignIn = async () => {
    const a = requireAuth();
    const provider = new GithubAuthProvider();
    await signInWithPopup(a, provider);
  };

  const firebaseSignOut = async () => {
    const a = requireAuth();
    await signOut(a);
    router.replace("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, emailSignIn, createAccount, gitHubSignIn, firebaseSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useUserAuth must be used inside an <AuthProvider>.");
  }
  return ctx;
}
