import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
 
const firebaseConfig = {
  apiKey: "AIzaSyDFicwQ1fVJm1Oyul7t1Cctr2dnsdrKBb8",
  authDomain: "cloudp3-test.firebaseapp.com",
  projectId: "cloudp3-test",
  storageBucket: "cloudp3-test.firebasestorage.app",
  messagingSenderId: "1019546303900",
  appId: "1:1019546303900:web:acba3eda1a46b79f69dc59",
};
 
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);