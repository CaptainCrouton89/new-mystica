// Mock for replicate module
const mockRun = jest.fn();

const mockReplicateInstance = {
  run: mockRun
};

class MockReplicate {
  constructor() {
    return mockReplicateInstance;
  }

  static run = mockRun;
}

MockReplicate.mockRun = mockRun;
MockReplicate.mockInstance = mockReplicateInstance;

module.exports = MockReplicate;
module.exports.default = MockReplicate;