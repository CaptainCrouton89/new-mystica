-- Seed data for San Francisco area locations
-- 30 real SF locations across 5 types for testing geolocation features

INSERT INTO locations (id, name, lat, lng, location_type, state_code, country_code) VALUES
-- Parks (6 locations)
(gen_random_uuid(), 'Golden Gate Park Main Entrance', 37.7694, -122.4862, 'park', 'CA', 'US'),
(gen_random_uuid(), 'Dolores Park', 37.7596, -122.4269, 'park', 'CA', 'US'),
(gen_random_uuid(), 'Alamo Square Park', 37.7762, -122.4345, 'park', 'CA', 'US'),
(gen_random_uuid(), 'Crissy Field', 37.8021, -122.4661, 'park', 'CA', 'US'),
(gen_random_uuid(), 'Washington Square Park', 37.8006, -122.4103, 'park', 'CA', 'US'),
(gen_random_uuid(), 'Mission Dolores Park Playground', 37.7570, -122.4270, 'park', 'CA', 'US'),

-- Libraries (6 locations)
(gen_random_uuid(), 'San Francisco Main Library', 37.7795, -122.4156, 'library', 'CA', 'US'),
(gen_random_uuid(), 'Mission Branch Library', 37.7580, -122.4199, 'library', 'CA', 'US'),
(gen_random_uuid(), 'Richmond Branch Library', 37.7807, -122.4644, 'library', 'CA', 'US'),
(gen_random_uuid(), 'Chinatown Branch Library', 37.7943, -122.4072, 'library', 'CA', 'US'),
(gen_random_uuid(), 'Castro Branch Library', 37.7609, -122.4350, 'library', 'CA', 'US'),
(gen_random_uuid(), 'Sunset Branch Library', 37.7583, -122.4945, 'library', 'CA', 'US'),

-- Gyms (6 locations)
(gen_random_uuid(), '24 Hour Fitness Downtown', 37.7879, -122.4075, 'gym', 'CA', 'US'),
(gen_random_uuid(), 'Crunch Fitness Mission', 37.7647, -122.4177, 'gym', 'CA', 'US'),
(gen_random_uuid(), 'Equinox SOMA', 37.7716, -122.3998, 'gym', 'CA', 'US'),
(gen_random_uuid(), 'Planet Fitness Geary', 37.7806, -122.4606, 'gym', 'CA', 'US'),
(gen_random_uuid(), 'Barry''s Bootcamp Marina', 37.8030, -122.4397, 'gym', 'CA', 'US'),
(gen_random_uuid(), 'CrossFit Golden Gate', 37.7955, -122.4194, 'gym', 'CA', 'US'),

-- Coffee Shops (6 locations)
(gen_random_uuid(), 'Blue Bottle Ferry Building', 37.7955, -122.3937, 'coffee_shop', 'CA', 'US'),
(gen_random_uuid(), 'Ritual Coffee Mission', 37.7608, -122.4214, 'coffee_shop', 'CA', 'US'),
(gen_random_uuid(), 'Philz Coffee Castro', 37.7609, -122.4350, 'coffee_shop', 'CA', 'US'),
(gen_random_uuid(), 'Four Barrel Coffee', 37.7647, -122.4177, 'coffee_shop', 'CA', 'US'),
(gen_random_uuid(), 'Sightglass Coffee SOMA', 37.7716, -122.3998, 'coffee_shop', 'CA', 'US'),
(gen_random_uuid(), 'Tartine Manufactory', 37.7570, -122.4199, 'coffee_shop', 'CA', 'US'),

-- Restaurants (6 locations)
(gen_random_uuid(), 'Zuni Cafe', 37.7795, -122.4224, 'restaurant', 'CA', 'US'),
(gen_random_uuid(), 'Swan Oyster Depot', 37.7943, -122.4185, 'restaurant', 'CA', 'US'),
(gen_random_uuid(), 'Tartine Bakery', 37.7570, -122.4240, 'restaurant', 'CA', 'US'),
(gen_random_uuid(), 'La Taqueria Mission', 37.7486, -122.4177, 'restaurant', 'CA', 'US'),
(gen_random_uuid(), 'House of Prime Rib', 37.7891, -122.4194, 'restaurant', 'CA', 'US'),
(gen_random_uuid(), 'Gary Danko', 37.8068, -122.4177, 'restaurant', 'CA', 'US');