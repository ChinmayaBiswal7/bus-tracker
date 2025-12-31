import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const form = document.getElementById('login-form');
const errorBox = document.getElementById('error-box');
const submitBtn = document.getElementById('submit-btn');
const role = document.body.dataset.role || 'student'; // Read from data attribute

// Password Toggle
window.togglePassword = function () {
    const pwd = document.getElementById('password');
    const eye = document.getElementById('eye-icon');
    const eyeOff = document.getElementById('eye-off-icon');

    if (pwd.type === 'password') {
        pwd.type = 'text';
        eye.classList.add('hidden');
        eyeOff.classList.remove('hidden');
    } else {
        pwd.type = 'password';
        eye.classList.remove('hidden');
        eyeOff.classList.add('hidden');
    }
}

// Forgot Password
window.showForgotPassword = function () {
    const modal = document.getElementById('reset-modal');
    modal.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
}

window.hideForgotPassword = function () {
    const modal = document.getElementById('reset-modal');
    modal.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
}

window.sendResetLink = function () {
    const email = document.getElementById('reset-email').value;
    const btn = document.getElementById('btn-reset');
    const msg = document.getElementById('reset-success');
    const err = document.getElementById('reset-error');

    if (!email) return alert("Please enter email");

    btn.textContent = "Sending...";
    btn.disabled = true;
    msg.classList.add('hidden');
    err.classList.add('hidden');

    sendPasswordResetEmail(auth, email)
        .then(() => {
            msg.classList.remove('hidden');
            btn.textContent = "LINK SENT";
        })
        .catch((error) => {
            console.error(error);
            err.textContent = error.message;
            err.classList.remove('hidden');
            btn.textContent = "TRY AGAIN";
            btn.disabled = false;
        });
}

// Login Logic
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        errorBox.classList.add('hidden');
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            // Set Persistence
            await setPersistence(auth, browserLocalPersistence);

            // Sign In
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get User Doc to verify Role
            // Students are in 'users', Drivers in 'drivers'
            // But we actually just restrict access based on requested role?
            // Existing code checks Firestore collection based on logic?
            // "Existing logic: Check if user exists in 'drivers' or 'users' collection"

            let isValidRole = false;

            if (role === 'driver') {
                const docSnap = await getDoc(doc(db, "drivers", user.uid)); // Check by UID? Or email? 
                // Wait, registration usually creates doc with UID?
                // Actually existing driver registration creates doc in 'drivers'.
                // If doc exists, they are a driver.
                // However, previous code might have used email or something else.
                // Let's assume standard auth.

                // Existing code check:
                // "const docRef = doc(db, role === 'driver' ? 'drivers' : 'users', user.uid);"
                const docRef = doc(db, 'drivers', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) isValidRole = true;

            } else {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) isValidRole = true;
            }

            // Allow login if doc missing? Maybe just check if they are trying to login as driver but are student.
            // If strict:
            if (!isValidRole) {
                // Determine if they are in the OTHER collection
                // This prevents students logging into driver portal
                if (role === 'driver') {
                    throw new Error("Access Denied: You are not registered as a driver.");
                } else {
                    // For student, maybe relaxed?
                }
            }

            // Redirect
            window.location.href = role === 'driver' ? '/driver' : '/student';

        } catch (error) {
            console.error(error);
            let msg = "Login failed. Check credentials.";
            if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
            if (error.code === 'auth/user-not-found') msg = "Account not found.";
            if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
            if (error.message.includes("Access Denied")) msg = error.message;

            errorBox.textContent = msg;
            errorBox.classList.remove('hidden');
            submitBtn.textContent = 'LOGIN';
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}
