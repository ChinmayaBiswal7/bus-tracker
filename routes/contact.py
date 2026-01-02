from flask import Blueprint, request, jsonify, render_template
import server.extensions
from firebase_admin import firestore
import datetime

contact_bp = Blueprint('contact', __name__)

@contact_bp.route('/contact')
def contact_page():
    # Helper to pre-fill info if available in query params
    email = request.args.get('email', '')
    role = request.args.get('role', '')
    return render_template('contact.html', email=email, role=role)

@contact_bp.route('/api/contact/submit', methods=['POST'])
def submit_contact():
    if not server.extensions.f_db:
        return jsonify({"status": "error", "message": "Database not connected"}), 500

    data = request.json
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')
    role = data.get('role', 'user')
    report_type = data.get('type', 'bug') # bug, feature, other

    if not name or not email or not message:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        # Save to 'feedback' collection
        doc_ref = server.extensions.f_db.collection('feedback').document()
        doc_ref.set({
            "name": name,
            "email": email,
            "message": message,
            "role": role,
            "type": report_type,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "status": "new"
        })

        return jsonify({"status": "success", "message": "Feedback submitted successfully"}), 200

    except Exception as e:
        print(f"[ERROR] Contact Submit: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
