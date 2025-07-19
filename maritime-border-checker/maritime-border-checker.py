from typing import Tuple
import sys

try:
    from data_loader import load_coastal_area_polygon
    from geometry_utils import create_shapely_polygon, is_point_in_coastal_area
    
    coastal_polygons = load_coastal_area_polygon()
    coastal_polygon = create_shapely_polygon(coastal_polygons)

    latitude = float(sys.argv[1])
    longitude = float(sys.argv[2])

    is_inside = is_point_in_coastal_area(latitude, longitude, coastal_polygon)

    print(is_inside)
except Exception as e:
    print(e)
    sys.exit(1)
