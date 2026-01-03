import pandas as pd
import os

# Create data directory if not exists
if not os.path.exists('data'):
    os.makedirs('data')

# Dummy Data for Bus 25 (Bhubaneswar Route) based on screenshot context
data = [
    # Bus 25 Route
    {"bus_no": "25", "stop_order": 1, "stop_name": "Satya Nagar", "lat": 20.2950, "lng": 85.8260},
    {"bus_no": "25", "stop_order": 2, "stop_name": "Vani Vihar", "lat": 20.3012, "lng": 85.8321},
    {"bus_no": "25", "stop_order": 3, "stop_name": "Acharya Vihar", "lat": 20.3040, "lng": 85.8300},
    {"bus_no": "25", "stop_order": 4, "stop_name": "Jaydev Vihar", "lat": 20.3080, "lng": 85.8250},
    {"bus_no": "25", "stop_order": 5, "stop_name": "Kalinga Hospital", "lat": 20.3150, "lng": 85.8200},
    {"bus_no": "25", "stop_order": 6, "stop_name": "Ranasinhpur", "lat": 20.3180, "lng": 85.8452},

    # Bus 42 (Another Route)
    {"bus_no": "42", "stop_order": 1, "stop_name": "Master Canteen", "lat": 20.2667, "lng": 85.8430},
    {"bus_no": "42", "stop_order": 2, "stop_name": "Rajmahal", "lat": 20.2700, "lng": 85.8350},
    {"bus_no": "42", "stop_order": 3, "stop_name": "Airport", "lat": 20.2550, "lng": 85.8150},
    
    # EV Shuttle (Campus Loop)
    {"bus_no": "EV-1", "stop_order": 1, "stop_name": "Admin Block", "lat": 20.2961, "lng": 85.8245},
    {"bus_no": "EV-1", "stop_order": 2, "stop_name": "Library", "lat": 20.2980, "lng": 85.8260},
    {"bus_no": "EV-1", "stop_order": 3, "stop_name": "Hostel 1", "lat": 20.3000, "lng": 85.8280}
]

df = pd.DataFrame(data)
df.to_excel("data/bus_routes.xlsx", index=False)
print("Created data/bus_routes.xlsx")
