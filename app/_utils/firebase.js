import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
 
const firebaseConfig = {
  apiKey: "AIzaSyD87UKXcreHjVa46xZUqV-k1Lt-pWLYcWc",
  authDomain: "cloud-p3-af4f9.firebaseapp.com",
  projectId: "cloud-p3-af4f9",
  storageBucket: "cloud-p3-af4f9.firebasestorage.app",
  messagingSenderId: "655473857420",
  appId: "1:655473857420:web:cad66b7f6bb0b9e42f7ca9",
};
 
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);