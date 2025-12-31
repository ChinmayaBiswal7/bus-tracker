import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, setDoc, doc, updateDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyAW7XS_Q_Kdh2eiYEaKBEHvZDpOk7-ynDg",
    authDomain: "bustracker-c0af6.firebaseapp.com",
    projectId: "bustracker-c0af6",
    storageBucket: "bustracker-c0af6.firebasestorage.app",
    messagingSenderId: "103145940746",
    appId: "1:103145940746:web:80a8444bff23e75b94fcf3",
    measurementId: "G-PKF72NB657"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Export for use in other modules
export { app, auth, db, messaging, collection, query, orderBy, limit, onSnapshot, getDocs, getToken, onMessage, addDoc, setDoc, doc, updateDoc, serverTimestamp, where };
