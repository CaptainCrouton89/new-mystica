-- PostGIS RPC function for finding nearby locations using geography calculations
-- Returns locations within specified radius ordered by distance

CREATE OR REPLACE FUNCTION get_nearby_locations(
  user_lat DECIMAL,
  user_lng DECIMAL,
  search_radius INT
)
RETURNS TABLE (
  id uuid,
  name varchar,
  lat decimal,
  lng decimal,
  location_type varchar,
  state_code varchar,
  country_code varchar,
  distance_meters float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.lat,
    l.lng,
    l.location_type,
    l.state_code,
    l.country_code,
    ST_Distance(
      ST_MakePoint(l.lng, l.lat)::geography,
      ST_MakePoint(user_lng, user_lat)::geography
    ) as distance_meters
  FROM locations l
  WHERE ST_DWithin(
    ST_MakePoint(l.lng, l.lat)::geography,
    ST_MakePoint(user_lng, user_lat)::geography,
    search_radius
  )
  ORDER BY distance_meters ASC;
END;
$$;