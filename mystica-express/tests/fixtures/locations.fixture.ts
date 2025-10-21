/**
 * Location Test Fixtures
 *
 * Provides standardized location objects for testing geospatial queries,
 * location-based combat, and distance calculations.
 */

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location_type: string;
  state_code: string;
  country_code: string;
  created_at?: string;
  distance_meters?: number;
}

/**
 * San Francisco Main Library location for testing library-type locations
 */
export const SF_LIBRARY: Location = {
  id: 'e6a0d42c-a301-4505-96a7-c71447fbec16',
  name: 'SF Main Library',
  lat: 37.7795,
  lng: -122.4156,
  location_type: 'library',
  state_code: 'CA',
  country_code: 'US',
  created_at: '2024-12-01T00:00:00Z',
  distance_meters: 610.3
};

/**
 * Golden Gate Park location for testing park-type locations and larger areas
 */
export const GOLDEN_GATE_PARK: Location = {
  id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
  name: 'Golden Gate Park',
  lat: 37.7694,
  lng: -122.4862,
  location_type: 'park',
  state_code: 'CA',
  country_code: 'US',
  created_at: '2024-12-01T00:00:00Z',
  distance_meters: 1200.5
};

/**
 * Invalid location for testing 404 error scenarios
 */
export const INVALID_LOCATION: Location = {
  id: '550e8400-e29b-41d4-a716-446655440099',
  name: 'Non-existent Location',
  lat: 0,
  lng: 0,
  location_type: 'unknown',
  state_code: 'XX',
  country_code: 'XX',
  created_at: '2024-01-01T00:00:00Z'
};

/**
 * Create custom location with property overrides
 *
 * @param overrides - Partial location properties to override defaults
 * @returns Location object with merged properties
 */
export function createLocation(overrides: Partial<Location> = {}): Location {
  return { ...SF_LIBRARY, ...overrides };
}