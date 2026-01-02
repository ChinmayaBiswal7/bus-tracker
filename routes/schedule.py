from flask import Blueprint, request, jsonify
from firebase_admin import firestore
import server.extensions
from datetime import datetime

schedule_bp = Blueprint('schedule', __name__)

@schedule_bp.route('/api/schedule/publish', methods=['POST'])
def publish_schedule():
    print(f"[DEBUG] Publish request received. f_db is: {server.extensions.f_db}")
    if not server.extensions.f_db:
        print("[ERROR] Database not connected")
        return jsonify({"status": "error", "message": "Database not connected"}), 500

    data = request.json
    bus_no = data.get('bus_no')
    date = data.get('date')
    timings = data.get('timings')

    if not bus_no or not date or not timings:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        # Save to: schedules/{busNo}/dates/{date}
        print(f"[DEBUG] Accessing collection: schedules/{bus_no}")
        schedule_ref = server.extensions.f_db.collection('schedules').document(bus_no)
        print(f"[DEBUG] Accessing date doc: {date}")
        date_ref = schedule_ref.collection('dates').document(date)

        payload = {
            "timings": timings,
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        print(f"[DEBUG] Attempting date_ref.set()... payload size: {len(str(payload))}")
        date_ref.set(payload)
        print("[DEBUG] date_ref.set() COMPLETED.")

        # Update metadata
        print("[DEBUG] Updating metadata...")
        schedule_ref.set({
            "last_update": firestore.SERVER_TIMESTAMP,
            "bus_no": bus_no
        }, merge=True)
        print("[DEBUG] Metadata updated. Success!")

        return jsonify({"status": "success", "message": "Schedule published"}), 200

    except Exception as e:
        print(f"[ERROR] Publish Schedule Failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
