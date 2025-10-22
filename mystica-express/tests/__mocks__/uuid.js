/**
 * Jest mock for uuid package
 *
 * Provides deterministic UUIDs for testing
 */

const uuid = {
  v4: jest.fn(() => 'mock-uuid-v4-1234-5678-9012-123456789012'),
  v1: jest.fn(() => 'mock-uuid-v1-1234-5678-9012-123456789012'),
  v5: jest.fn(() => 'mock-uuid-v5-1234-5678-9012-123456789012'),
  parse: jest.fn((str) => Buffer.from(str.replace(/-/g, ''), 'hex')),
  stringify: jest.fn((buf) => 'mock-stringified-uuid'),
  NIL: '00000000-0000-0000-0000-000000000000',
  MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
};

module.exports = uuid;