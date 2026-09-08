import csv
import os
from math import radians, cos, sin, asin, sqrt


def haversine(lon1, lat1, lon2, lat2):
    """Calculate the great circle distance between two points on earth (in kilometers)"""
    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    
    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r


def find_closest_trees(file_path, user_lon, user_lat, num_trees=10):
    trees = []
    
    with open(file_path, mode='r', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader)


        
        
        # Read all trees and calculate distance
        for row in reader:
            try:
                tree_lon = float(row[12])
                tree_lat = float(row[13])
                distance = haversine(user_lon, user_lat, tree_lon, tree_lat)
                
                trees.append({
                    'distance': distance,
                    'gattung': row[2],
                    'art': row[3],
                    'sorte': row[4],
                    'name': row[5],
                    'hoehe': row[6],
                    'typ': row[9],
                    'xpos': row[10],
                    'ypos': row[11],
                    'lon': tree_lon,
                    'lat': tree_lat
                })
            except (ValueError, IndexError):
                continue
    
    # Sort by distance and get closest trees
    trees.sort(key=lambda x: x['distance'])
    closest = trees[:num_trees]
    
    print(f"\n10 Closest Trees to ({user_lon}, {user_lat}):")
    print("-" * 100)
    
    for i, tree in enumerate(closest, 1):
        print(f"{i}. Distance: {tree['distance']:.2f} km - Gattung: {tree['gattung']}, Art: {tree['art']}, "
              f"Sorte: {tree['sorte']}, Name: {tree['name']}, Höhe: {tree['hoehe']}m, "
              f"Typ: {tree['typ']}, lon: {tree['lon']}, lat: {tree['lat']}")


path = os.path.join("data", "Baumkataster.csv")

user_lon = float(input("Enter longitude >_ "))
user_lat = float(input("Enter latitude >_ "))

find_closest_trees(path, user_lon, user_lat)
