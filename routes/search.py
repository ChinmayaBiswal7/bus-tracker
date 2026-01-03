from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
# Import Bus model (will need a clean way, likely circular import workaround or from extensions if possible)
# Actually, Bus is in app.py. We should move Bus model to extensions or models.
# But for now, app.py imports routes, so routes cannot import app.
# SOLUTION: We will assume 'Bus' is passed or imported from a models file.
# Since we haven't refactored models yet, we will use a common pattern:
# Pass the 'Bus' model class to the init function or use current_app.
# However, for simplicity in this specific project structure where models are in app.py:
# We will do a local import inside the function or move Bus to server/models.py
# Let's try to keep it simple.
# Wait, 'Bus' is a SQLAlchemy model.
# Re-reading app.py: "db = SQLAlchemy(app)" is in app.py.
# If we move this to routes/search.py, we need 'Bus'.
# Attempting to import 'Bus' from app will fail due to circular import (app imports search_bp).

# STRATEGY: 
# 1. Define Blueprint here.
# 2. Use a "lazy import" for Bus inside the function to avoid circular dependency at top level.
#    "from app import Bus" inside get_stop_status.
#    This works in Flask often because app is fully created when request happens.

search_bp = Blueprint('search_bp', __name__)

# Global reference for engine
search_engine = None

def init_search_engine(engine):
    global search_engine
    search_engine = engine

@search_bp.route('/api/search-stop', methods=['GET'])
def search_stop():
    """Search for bus stops with fuzzy matching (Module Based)"""
    if not search_engine:
        return jsonify({'success': False, 'error': 'Engine not initialized'}), 500

    query = request.args.get('q', '').strip()
    threshold = float(request.args.get('threshold', 0.4)) 
    
    if not query: return jsonify({'success': False, 'error': 'Query required'}), 400
    
    try:
        results = search_engine.fuzzy_search(query, threshold)
        return jsonify({
            'success': True,
            'query': query,
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        print(f"[ERROR] Search API: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@search_bp.route('/api/stop-status/<stop_name>', methods=['GET'])
def get_stop_status(stop_name):
    """Get live status of buses at a stop"""
    if not search_engine:
        return jsonify({'success': False, 'error': 'Engine not initialized'}), 500
        
    try:
        if stop_name not in search_engine.stop_to_buses:
            return jsonify({'success': False, 'error': 'Stop not found'}), 404
        
        buses = list(search_engine.stop_to_buses[stop_name])
        
        # LAZY IMPORT MODEL to avoid circular import
        from app import Bus
        
        # Query Active Buses (STALENESS CHECK enforced)
        threshold = datetime.utcnow() - timedelta(minutes=10)
        active_buses = Bus.query.filter(Bus.is_active==True, Bus.last_updated >= threshold).all()
        active_map = {b.bus_no: b for b in active_buses}
        
        live_buses = []
        for bus_no in buses:
            bus_no_str = str(bus_no)
            if bus_no_str in active_map:
                b = active_map[bus_no_str]
                live_buses.append({
                    'bus_no': bus_no_str,
                    'lat': b.lat,
                    'lng': b.lng,
                    'speed': b.speed,
                    'heading': b.heading,
                    'crowd': b.crowd_status,
                    'is_online': True
                })
            else:
                live_buses.append({
                    'bus_no': bus_no_str,
                    'is_online': False
                })
        
        return jsonify({
            'success': True,
            'stop_name': stop_name,
            'buses': live_buses
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
