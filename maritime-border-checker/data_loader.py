import json
from typing import List

def load_coastal_area_polygon() -> List[List[List[List[float]]]]:
    """
    Load the coastal area polygon coordinates from the costal_area.json file.
    
    Returns:
        List[List[List[List[float]]]]: A list of polygons, where each polygon 
        is a list of rings (outer ring + optional inner rings), and each ring is a 
        list of coordinate lists [longitude, latitude].
    """
    try:
        with open('costal_area.json', 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        if data.get('type') == 'FeatureCollection' and 'features' in data:
            feature = data['features'][0]
            
            if (feature.get('type') == 'Feature' and 
                feature.get('geometry', {}).get('type') == 'MultiPolygon'):
                
                coordinates = feature['geometry']['coordinates']
                return coordinates
            else:
                raise ValueError("Invalid GeoJSON structure: Expected Feature with MultiPolygon geometry")
        else:
            raise ValueError("Invalid GeoJSON structure: Expected FeatureCollection")
            
    except FileNotFoundError:
        raise FileNotFoundError("costal_area.json file not found")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {e}")
    except Exception as e:
        raise Exception(f"Error loading coastal area data: {e}") 