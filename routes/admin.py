from flask import Blueprint, render_template, request, jsonify
from datetime import datetime
import server.extensions
from firebase_admin import messaging, firestore

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/api/admin/stops')
def get_stops_data():
    from server.extensions import ROUTES_CACHE # Still use Cache for static routes
    import sqlite3
    
    try:
        print(f"[DEBUG] Admin Stops API via SQLite. ROUTES_CACHE Size: {len(ROUTES_CACHE) if ROUTES_CACHE else 0}")
        
        # 1. Gather Unique Stops from ROUTES_CACHE (Excel Data)
        stops_map = {} # name -> {lat, lng}
        
        if ROUTES_CACHE:
            for bus_no, bus_data in ROUTES_CACHE.items():
                for stop in bus_data.get('stops', []):
                    s_name = stop.get('stop_name')
                    if s_name and s_name not in stops_map:
                        stops_map[s_name] = {
                            "lat": stop.get('lat'),
                            "lng": stop.get('lng')
                        }

        # 2. Get Dynamic Demand (Waiting Counts) via Raw SQLite
        requests = []
        try:
            conn = sqlite3.connect('buses.db')
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            # Ensure table exists check or just try
            cursor.execute("SELECT stop_name, count, lat, lng FROM stop_request WHERE is_arrived=0")
            requests = cursor.fetchall()
            conn.close()
        except Exception as db_err:
            print(f"[WARN] SQLite DB Read Error: {db_err}")
            # If table doesn't exist yet, just continue with empty requests
            requests = []
        
        stop_counts = {}
        for req in requests:
            name = req['stop_name'] # dict-like access
            count = req['count']
            stop_counts[name] = stop_counts.get(name, 0) + count
            
            if name not in stops_map and req['lat'] and req['lng']:
                 stops_map[name] = {
                    "lat": req['lat'],
                    "lng": req['lng']
                }

        # 3. Form Final Result
        result = []
        for name, coords in stops_map.items():
            waiting = stop_counts.get(name, 0)
            result.append({
                "name": name,
                "lat": coords['lat'],
                "lng": coords['lng'],
                "waiting": waiting
            })
            
        print(f"[DEBUG] Returns {len(result)} stops.")
        return jsonify(result), 200

    except Exception as e:
        print(f"[ADMIN STOPS ERROR] {e}")
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/admin')
def admin_dashboard():
    return render_template('admin.html')

@admin_bp.route('/api/admin/announce', methods=['POST'])
def send_announcement():
    try:
        data = request.json
        message = data.get('message')
        target = data.get('target') # 'student' or 'driver'
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400

        db = server.extensions.f_db
        
        if db is None:
            print("[ADMIN ERROR] Firestore DB is not initialized (db is None).")
            return jsonify({'error': 'Database connection failed'}), 500

        print(f"[ADMIN] Sending announcement to {target}: {message}")
        # timestamp = firestore.SERVER_TIMESTAMP # causing issues?
        timestamp = datetime.utcnow()

        if target == 'student':
            # 1. Save to 'messages' collection (Global)
            print("[ADMIN] Writing to university/kiit/messages")
            ref = db.collection('university').document('kiit').collection('messages')
            ref.add({
                'message': message,
                'bus_no': 'ADMIN',
                'timestamp': timestamp,
                'type': 'general',
                'is_admin': True # FLAG for styling
            })
            
        elif target == 'driver':
            # 1. Save to 'driver_messages' collection
            ref = db.collection('university').document('kiit').collection('driver_messages')
            ref.add({
                'message': message,
                'author': 'Admin',
                'timestamp': timestamp,
                'is_important': True
            })
            
            # Drivers need their own listener (we will build this in driver_announcements.js)
            
        else:
            return jsonify({'error': 'Invalid target'}), 400

        return jsonify({'status': 'success', 'message': 'Announcement Sent'}), 200

    except Exception as e:
        print(f"[ADMIN ERROR] {e}")
        return jsonify({'error': str(e)}), 500
