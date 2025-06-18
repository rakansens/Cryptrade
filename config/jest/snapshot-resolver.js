const path = require('path');

module.exports = {
  // resolves from test to snapshot path
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    const path = require('path');
    const testDir = path.dirname(testPath);
    const testFile = path.basename(testPath);
    
    // Place snapshots in __snapshots__ directory next to test file
    return path.join(testDir, '__snapshots__', testFile + snapshotExtension);
  },

  // resolves from snapshot to test path
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    const path = require('path');
    const snapshotDir = path.dirname(snapshotFilePath);
    const parentDir = path.dirname(snapshotDir);
    const snapshotFile = path.basename(snapshotFilePath);
    
    // Remove the snapshot extension to get the test file name
    const testFile = snapshotFile.slice(0, -snapshotExtension.length);
    
    return path.join(parentDir, testFile);
  },

  // Example test path, used for preflight consistency check of the implementation above
  testPathForConsistencyCheck: 'tests/unit/example.test.ts',
};