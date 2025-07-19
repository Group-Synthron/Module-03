from typing import List
from shapely.geometry import Point, MultiPolygon
from shapely.ops import unary_union

def create_shapely_polygon(coordinates: List[List[List[List[float]]]]) -> MultiPolygon:
    """
    Convert the polygon coordinates to a Shapely MultiPolygon object.
    
    Args:
        coordinates: The polygon coordinates from load_coastal_area_polygon()
    
    Returns:
        MultiPolygon: A Shapely MultiPolygon object representing the coastal area
    """
    try:
        shapely_coords = []
        for polygon in coordinates:
            rings = [ [tuple(point) for point in ring] for ring in polygon ]
            if len(rings) == 1:
                shapely_coords.append((rings[0],))
            else:
                shapely_coords.append((rings[0], rings[1:]))

        multi_polygon = MultiPolygon(shapely_coords)
        merged_polygon = unary_union(multi_polygon)
        return merged_polygon
    except Exception as e:
        raise Exception(f"Error creating Shapely polygon: {e}")

def is_point_in_coastal_area(latitude: float, longitude: float, coastal_polygon: MultiPolygon = None) -> bool:
    """
    Check if a given point (latitude, longitude) is inside the Sri Lanka coastal area polygon.
    
    Args:
        latitude: The latitude of the point to check
        longitude: The longitude of the point to check
        coastal_polygon: Optional pre-loaded coastal polygon. If None, will load from file.
    
    Returns:
        bool: True if the point is inside the coastal area, False otherwise
    """
    try:
        point = Point(longitude, latitude)  

        if coastal_polygon is None:
            from data_loader import load_coastal_area_polygon
            coordinates = load_coastal_area_polygon()
            coastal_polygon = create_shapely_polygon(coordinates)
        
        return coastal_polygon.contains(point)
        
    except Exception as e:
        raise Exception(f"Error checking point in coastal area: {e}")
