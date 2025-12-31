document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const typeBtns = document.querySelectorAll('.type-btn');
    const reportTypeInput = document.getElementById('report-type');
    const btnSubmit = document.getElementById('btn-submit');
    const successMsg = document.getElementById('success-msg');

    // Handle Type Selection
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active', 'text-white'));
            typeBtns.forEach(b => b.classList.add('text-gray-400'));

            btn.classList.add('active', 'text-white');
            btn.classList.remove('text-gray-400');
            reportTypeInput.value = btn.dataset.type;
        });
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        const role = document.getElementById('role').value || 'user';
        const type = reportTypeInput.value;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Sending...</span>`;
        btnSubmit.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            const res = await fetch('/api/contact/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message, role, type })
            });

            const data = await res.json();

            if (res.ok) {
                // Success
                form.classList.add('hidden');
                successMsg.classList.remove('hidden');
                successMsg.classList.add('animate-fade-in-up');
            } else {
                throw new Error(data.message || "Failed to send");
            }

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Send Message</span>`;
            btnSubmit.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });
});
