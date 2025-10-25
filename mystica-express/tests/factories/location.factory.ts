// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';

type Location = Database['public']['Tables']['locations']['Row'];
type LocationInsert = Database['public']['Tables']['locations']['Insert'];

/**
 * Factory for generating Location test data with flexible overrides
 */
export class LocationFactory {
  /**
   * Create location with random coordinates within bounds
   */
  static createRandom(type: string, overrides?: Partial<Location>): Location {
    // Generate random coordinates within reasonable US bounds
    const lat = this.randomFloat(25.0, 49.0); // Continental US latitude range
    const lng = this.randomFloat(-125.0, -66.0); // Continental US longitude range

    const baseLocation: Location = {
      id: generateUuid(),
      lat: lat,
      lng: lng,
      location_type: type,
      name: this.generateLocationName(type),
      state_code: 'CA', // Default to California
      country_code: 'US',
      image_url: null,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return baseLocation;
  }

  /**
   * Create location near coordinates (for proximity tests)
   */
  static createNear(lat: number, lng: number, distanceMeters: number, overrides?: Partial<Location>): Location {
    // Calculate lat/lng offset for the given distance
    // Approximate: 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
    const latOffset = (distanceMeters / 111000) * (Math.random() - 0.5) * 2;
    const lngOffset = (distanceMeters / (111000 * Math.cos(lat * Math.PI / 180))) * (Math.random() - 0.5) * 2;

    const nearbyLat = lat + latOffset;
    const nearbyLng = lng + lngOffset;

    const baseLocation: Location = {
      id: generateUuid(),
      lat: nearbyLat,
      lng: nearbyLng,
      location_type: 'landmark',
      name: `Location near (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      state_code: 'CA',
      country_code: 'US',
      image_url: null,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return baseLocation;
  }

  /**
   * Create SF location (default to California)
   */
  static createSF(type: string, overrides?: Partial<Location>): Location {
    // San Francisco bounds: 37.7-37.8 lat, -122.5 to -122.4 lng
    const lat = this.randomFloat(37.7, 37.8);
    const lng = this.randomFloat(-122.5, -122.4);

    const sfLocation: Location = {
      id: generateUuid(),
      lat: lat,
      lng: lng,
      location_type: type,
      name: this.generateSFLocationName(type),
      state_code: 'CA',
      country_code: 'US',
      image_url: null,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return sfLocation;
  }

  /**
   * Create location with specific coordinates
   */
  static createAtCoordinates(lat: number, lng: number, type: string = 'landmark', overrides?: Partial<Location>): Location {
    return {
      id: generateUuid(),
      lat: lat,
      lng: lng,
      location_type: type,
      name: `${type} at (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      state_code: 'CA',
      country_code: 'US',
      image_url: null,
      created_at: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Create multiple locations in a cluster
   */
  static createCluster(centerLat: number, centerLng: number, count: number, radiusMeters: number = 1000): Location[] {
    return Array.from({ length: count }, () =>
      this.createNear(centerLat, centerLng, radiusMeters)
    );
  }

  /**
   * Create location for database insertion (Insert type)
   */
  static createForInsert(overrides?: Partial<LocationInsert>): LocationInsert {
    const location = this.createSF('landmark');
    return {
      id: location.id,
      lat: location.lat,
      lng: location.lng,
      location_type: location.location_type,
      name: location.name,
      state_code: location.state_code,
      country_code: location.country_code,
      ...overrides
    };
  }

  /**
   * Create multiple locations at once
   */
  static createMany(count: number, factory: () => Location = () => this.createSF('landmark')): Location[] {
    return Array.from({ length: count }, () => factory());
  }

  /**
   * Generate random float between min and max
   */
  private static randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate location name based on type
   */
  private static generateLocationName(type: string): string {
    const names: Record<string, string[]> = {
      landmark: ['Historic Monument', 'Memorial Park', 'City Square', 'Old Bridge', 'Town Hall'],
      park: ['Central Park', 'River Park', 'Oak Grove', 'Pine Forest', 'Sunset Park'],
      shop: ['Corner Store', 'Main Street Shop', 'Village Market', 'Trading Post', 'General Store'],
      restaurant: ['Family Diner', 'Corner Cafe', 'Main Street Bistro', 'Local Eatery', 'Town Grill'],
      school: ['Elementary School', 'High School', 'Community Center', 'Learning Academy', 'Public School']
    };

    const typeNames = names[type] || names['landmark'];
    const randomName = typeNames[Math.floor(Math.random() * typeNames.length)];
    const suffix = Math.random().toString(36).substring(7);

    return `${randomName} ${suffix}`;
  }

  /**
   * Generate SF-specific location name
   */
  private static generateSFLocationName(type: string): string {
    const sfNames: Record<string, string[]> = {
      landmark: ['Golden Gate Viewpoint', 'Lombard Street Corner', 'Fishermans Wharf', 'Union Square', 'Chinatown Gate'],
      park: ['Golden Gate Park', 'Dolores Park', 'Crissy Field', 'Buena Vista Park', 'Lafayette Park'],
      shop: ['Castro Street Shop', 'Mission District Store', 'North Beach Market', 'SOMA Boutique', 'Richmond Shop'],
      restaurant: ['Mission Burrito', 'North Beach Cafe', 'Castro Bistro', 'SOMA Diner', 'Richmond Eatery'],
      school: ['UCSF Campus', 'SF State', 'Community College', 'Art Institute', 'Language School']
    };

    const typeNames = sfNames[type] || sfNames['landmark'];
    const randomName = typeNames[Math.floor(Math.random() * typeNames.length)];

    return randomName;
  }
}