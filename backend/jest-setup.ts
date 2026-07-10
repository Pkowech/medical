/**
 * Jest setup file for handling global teardown
 * Closes any open handles and connections after tests complete
 */

// Increase Jest timeout for integration tests
jest.setTimeout(60000);

// Add global test timeout handler
afterAll(() => {
  // Give async operations time to complete
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
});
