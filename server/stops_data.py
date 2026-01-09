
# Static Bus Stop Data (Source of Truth)

STOPS_DATA = [
    # Bus 25 Route
    {"stop_name": "Satya Nagar", "lat": 20.2950, "lng": 85.8260},
    {"stop_name": "Vani Vihar", "lat": 20.3012, "lng": 85.8321},
    {"stop_name": "Acharya Vihar", "lat": 20.3040, "lng": 85.8300},
    {"stop_name": "Jaydev Vihar", "lat": 20.3080, "lng": 85.8250},
    {"stop_name": "Kalinga Hospital", "lat": 20.3150, "lng": 85.8200},
    {"stop_name": "Ranasinhpur", "lat": 20.3180, "lng": 85.8452},

    # Bus 42 Route
    {"stop_name": "Master Canteen", "lat": 20.2667, "lng": 85.8430},
    {"stop_name": "Rajmahal", "lat": 20.2700, "lng": 85.8350},
    {"stop_name": "Airport", "lat": 20.2550, "lng": 85.8150},
    
    # Campus Loop (EV)
    {"stop_name": "Admin Block", "lat": 20.2961, "lng": 85.8245},
    {"stop_name": "Library", "lat": 20.2980, "lng": 85.8260},
    {"stop_name": "Hostel 1", "lat": 20.3000, "lng": 85.8280},
    
    # Common Stops (Merged/Unique list logic handled here or in admin.py)
]

def get_unique_stops():
    seen = set()
    unique_stops = []
    for stop in STOPS_DATA:
        if stop['stop_name'] not in seen:
            seen.add(stop['stop_name'])
            unique_stops.append(stop)
    return unique_stops
