from flask import Blueprint, request, jsonify
from firebase_admin import firestore
from server.extensions import f_db
from datetime import datetime

schedule_bp = Blueprint('schedule', __name__)

@schedule_bp.route('/api/schedule/publish', methods=['POST'])
def publish_schedule():
    if not f_db:
        return jsonify({"status": "error", "message": "Database not connected"}), 500

    data = request.json
    bus_no = data.get('bus_no')
    date = data.get('date')
    timings = data.get('timings')

    if not bus_no or not date or not timings:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        # Save to: schedules/{busNo}/dates/{date}
        schedule_ref = f_db.collection('schedules').document(bus_no)
        date_ref = schedule_ref.collection('dates').document(date)

        date_ref.set({
            "timings": timings,
            "updated_at": firestore.SERVER_TIMESTAMP
        })

        # Update metadata
        schedule_ref.set({
            "last_update": firestore.SERVER_TIMESTAMP,
            "bus_no": bus_no
        }, merge=True)

        return jsonify({"status": "success", "message": "Schedule published"}), 200

    except Exception as e:
        print(f"[ERROR] Publish Schedule: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
