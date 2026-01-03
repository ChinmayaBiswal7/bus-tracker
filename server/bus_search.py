"""
Bus Stop Fuzzy Search Module
"""
import pandas as pd
from difflib import get_close_matches
from collections import defaultdict
import sqlite3
import os

class BusStopSearchEngine:
    def __init__(self, excel_path='data/bus_routes.xlsx'):
        """Initialize the search engine with your Excel file"""
        self.excel_path = excel_path
        # Load immediately if exists
        if os.path.exists(excel_path):
            self.reload_data()
        else:
            print(f"[WARN] Search Engine: Excel file not found at {excel_path}")
            self.df = pd.DataFrame()
            self.stop_to_buses = {}
            self.all_stop_names = []
            self.all_stop_names_lower = []

    def reload_data(self):
        try:
            self.df = pd.read_excel(self.excel_path)
            # Ensure types
            self.df['bus_no'] = self.df['bus_no'].astype(str)
            
            self.stop_to_buses = self._build_stop_index()
            self.all_stop_names = list(self.stop_to_buses.keys())
            self.all_stop_names_lower = [s.lower() for s in self.all_stop_names]
            print(f"[INFO] Search Engine Loaded: {len(self.all_stop_names)} stops.")
        except Exception as e:
            print(f"[ERROR] Search Engine Load Failed: {e}")

    def _build_stop_index(self):
        """Build index: stop_name -> {bus_no1, bus_no2, ...}"""
        stop_index = defaultdict(set)
        
        for _, row in self.df.iterrows():
            stop_name = str(row['stop_name']).strip()
            bus_no = str(row['bus_no']) # Keep as string for consistency
            stop_index[stop_name].add(bus_no)
        
        return stop_index
    
    def fuzzy_search(self, query, threshold=0.5, max_results=5):
        """
        Search for stops with fuzzy matching
        """
        if not query or not query.strip():
            return []
        
        # Clean the query
        query_clean = query.strip().lower()
        
        # Find fuzzy matches
        matches = get_close_matches(
            query_clean,
            self.all_stop_names_lower,
            n=max_results,
            cutoff=threshold
        )
        
        # Also include direct substring matches (Priority)
        # e.g. "kiit" matches "kiit square" even if fuzzy score is low
        substring_matches = [s for s in self.all_stop_names_lower if query_clean in s]
        
        # Merge lists (substring first, then fuzzy)
        final_matches_lower = []
        seen = set()
        
        # Helper to add unique
        def add_unique(lst):
            for m in lst:
                if m not in seen:
                    final_matches_lower.append(m)
                    seen.add(m)
        
        add_unique(substring_matches)
        add_unique(matches)
        
        # Limit results
        final_matches_lower = final_matches_lower[:max_results]

        # Build results with proper capitalization
        results = []
        for match_lower in final_matches_lower:
            # Find original stop name
            if match_lower in self.all_stop_names_lower:
                idx = self.all_stop_names_lower.index(match_lower)
                original_stop = self.all_stop_names[idx]
                
                # Get buses for this stop
                buses = sorted(list(self.stop_to_buses[original_stop]), key=lambda x: int(x) if x.isdigit() else 999)
                
                # Get coordinates (Take first occurrence)
                stop_data_rows = self.df[self.df['stop_name'] == original_stop]
                if not stop_data_rows.empty:
                    stop_data = stop_data_rows.iloc[0]
                    results.append({
                        'stop_name': original_stop,
                        'buses': buses,
                        'bus_count': len(buses),
                        'lat': float(stop_data['lat']),
                        'lng': float(stop_data['lng'])
                    })
        
        return results
    
    def get_bus_route(self, bus_no):
        """Get complete route for a specific bus number"""
        bus_no = str(bus_no)
        bus_data = self.df[self.df['bus_no'] == bus_no].sort_values('stop_order')
        
        if bus_data.empty:
            return None
        
        route = []
        for _, row in bus_data.iterrows():
            route.append({
                'stop_order': int(row['stop_order']),
                'stop_name': row['stop_name'],
                'lat': float(row['lat']),
                'lng': float(row['lng'])
            })
        
        return {
            'bus_no': bus_no,
            'total_stops': len(route),
            'stops': route
        }
    
    def get_all_stops(self):
        """Get all unique stop names"""
        return sorted(self.all_stop_names)
