// Use root-level jest.config.js as base after config cleanup
const baseConfig = require('../../jest.config.js');

// Get shard info from environment variables
const shardIndex = parseInt(process.env.JEST_SHARD_INDEX || '1', 10);
const totalShards = parseInt(process.env.JEST_SHARD_TOTAL || '1', 10);

// Create sharded configuration
module.exports = {
  ...baseConfig,
  // Override specific settings for sharding
  displayName: `Shard ${shardIndex}/${totalShards}`,
  // Use test sequencer for sharding
  testSequencer: '<rootDir>/jest.shard-sequencer.js',
  // Increase workers for each shard
  maxWorkers: 4,
  // Disable coverage in sharded mode (collect in a separate run)
  collectCoverage: false,
};