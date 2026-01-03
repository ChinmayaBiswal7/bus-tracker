import sys
import os
from app import app, ROUTES_CACHE

print(f"Routes Cache Size: {len(ROUTES_CACHE)}")

with app.test_request_context('/api/search_stops?q=kiit'):
    from app import search_stops
    response = search_stops()
    print(f"Status: {response.status_code}")
    print(f"Data: {response.get_json()}")
