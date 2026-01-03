import sys
import os
from app import app

print("Testing /api/stop_search...")
with app.test_request_context('/api/stop_search?q=kiit'):
    from app import stop_search
    response = stop_search()
    print(f"Status: {response.status_code}")
    print(f"Data: {response.get_json()}")
