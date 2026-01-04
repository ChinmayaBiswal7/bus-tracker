import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('loading-overlay');

    if (user) {
        console.log("User found, checking role...");
        try {
            // Check Users
            let role = 'student'; // Default fallback? Or check both?

            // We need to check 'users' (student) or 'drivers'
            // The original code only checked 'users' collection for the role field?
            // "const docRef = doc(db, "users", user.uid);"
            // "if (docSnap.exists()) { const role = docSnap.data().role; ... }"

            // IF the original code only checked 'users', it implies drivers might be in 'users' OR 'drivers' was not fully separated in the simplified version.
            // BUT in signup.js, we put drivers in 'drivers' and students in 'users'.
            // So we must check BOTH or check based on some other heuristic.

            // Let's check 'drivers' first (more specific)
            let docRef = doc(db, "drivers", user.uid);
            let docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                window.location.href = '/driver';
                return;
            }

            // Check 'users'
            docRef = doc(db, "users", user.uid);
            docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.role === 'driver') window.location.href = '/driver'; // Just in case
                else window.location.href = '/student';
            } else {
                // Profile missing
                if (overlay) overlay.style.opacity = '0';
                setTimeout(() => overlay?.remove(), 500);
            }

        } catch (error) {
            console.error("Error fetching role:", error);
            if (overlay) overlay.style.opacity = '0';
            setTimeout(() => overlay?.remove(), 500);
        }
    } else {
        // No user, show selection screen
        console.log("No active session.");
        if (overlay) overlay.style.opacity = '0';
        setTimeout(() => overlay?.remove(), 500);
    }
});
