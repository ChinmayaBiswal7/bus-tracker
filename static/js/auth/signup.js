import { auth, db } from '../firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('signup-form');
const errorBox = document.getElementById('error-box');
const submitBtn = document.getElementById('submit-btn');
const role = document.body.dataset.role || 'student';

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

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        let mobile = "";

        if (role === 'driver') {
            const mobileInput = document.getElementById('mobile');
            if (mobileInput) mobile = mobileInput.value;
        }

        errorBox.classList.add('hidden');
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Update Profile Name
            await updateProfile(user, {
                displayName: username
            });

            // 3. Save Role to Firestore
            // 3. Save Role to Firestore
            if (role === 'driver') {
                await setDoc(doc(db, "drivers", user.uid), {
                    name: username,
                    email: email,
                    role: 'driver',
                    mobile: mobile,
                    joined: serverTimestamp(),
                    is_active: false // Approval needed? Or default false
                });
            } else if (role === 'admin') {
                await setDoc(doc(db, "admins", user.uid), {
                    name: username,
                    email: email,
                    role: 'admin',
                    joined: serverTimestamp()
                });
            } else {
                await setDoc(doc(db, "users", user.uid), {
                    name: username,
                    email: email,
                    role: 'student',
                    joined: serverTimestamp()
                });
            }

            // 4. Redirect
            // alert("Account Created! Redirecting...");
            if (role === 'driver') window.location.href = '/driver';
            else if (role === 'admin') window.location.href = '/admin';
            else window.location.href = '/student';

        } catch (error) {
            console.error(error);
            let msg = "Signup failed.";
            if (error.code === 'auth/email-already-in-use') msg = "Email already registered.";
            if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";

            errorBox.textContent = msg;
            errorBox.classList.remove('hidden');
            submitBtn.textContent = 'CREATE ACCOUNT';
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}
