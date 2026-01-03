import sys
import os

# Mock Flask app context if needed, or just import the class
try:
    from server.bus_search import BusStopSearchEngine
    print("Import successful.")
except ImportError:
    print("Import failed. Fixing path...")
    sys.path.append(os.getcwd())
    from server.bus_search import BusStopSearchEngine

def test_search():
    print("--- Initializing Engine ---")
    engine = BusStopSearchEngine('data/bus_routes.xlsx')
    
    if not engine.all_stop_names:
        print("ERROR: No stops loaded. Check match with excel file.")
        return

    print(f"Loaded {len(engine.all_stop_names)} stops.")
    
    query = "kiit"
    print(f"--- Searching for '{query}' ---")
    results = engine.fuzzy_search(query, threshold=0.4)
    
    if results:
        print(f"SUCCESS: Found {len(results)} matches.")
        for r in results:
            print(f" - {r['stop_name']} (Buses: {r['buses']})")
    else:
        print("FAILURE: No matches found.")

if __name__ == "__main__":
    test_search()
