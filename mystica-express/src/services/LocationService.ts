import { supabase } from '../config/supabase';
import { DatabaseError, NotFoundError } from '../utils/errors';

/**
 * Handles location-based operations using PostGIS geospatial queries
 */
export class LocationService {
  /**
   * Find nearby locations within specified radius using PostGIS geography calculations
   * - Uses get_nearby_locations RPC function with ST_DWithin for efficient spatial queries
   * - Returns results ordered by distance (closest first)
   */
  async nearby(lat: number, lng: number, radius: number) {
    const { data, error } = await supabase.rpc('get_nearby_locations', {
      user_lat: lat,
      user_lng: lng,
      search_radius: radius,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch nearby locations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get specific location by ID
   * - Fetches complete location data
   * - Throws NotFoundError if location doesn't exist
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new DatabaseError(`Failed to fetch location: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('Location');
    }

    return data;
  }
}

export const locationService = new LocationService();