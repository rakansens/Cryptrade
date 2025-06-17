const Sequencer = require('@jest/test-sequencer').default;
const crypto = require('crypto');

class ShardSequencer extends Sequencer {
  sort(tests) {
    // Get shard configuration
    const shardIndex = parseInt(process.env.JEST_SHARD_INDEX || '1', 10) - 1;
    const totalShards = parseInt(process.env.JEST_SHARD_TOTAL || '1', 10);

    // Sort tests by path for consistent ordering
    const sortedTests = [...tests].sort((a, b) => a.path.localeCompare(b.path));

    // Distribute tests across shards using hash-based assignment
    const shardedTests = sortedTests.filter((test) => {
      const hash = crypto.createHash('md5').update(test.path).digest('hex');
      const hashNumber = parseInt(hash.substring(0, 8), 16);
      return (hashNumber % totalShards) === shardIndex;
    });

    // Sort by test duration (slowest first) if available
    return this.sortByDuration(shardedTests);
  }

  sortByDuration(tests) {
    // Try to get cached test durations
    const { testDurations } = this.getCacheData() || {};
    
    if (!testDurations) {
      return tests;
    }

    return tests.sort((a, b) => {
      const durationA = testDurations[a.path] || 0;
      const durationB = testDurations[b.path] || 0;
      return durationB - durationA; // Slowest first
    });
  }

  getCacheData() {
    try {
      return this.cache.get();
    } catch {
      return null;
    }
  }
}

module.exports = ShardSequencer;