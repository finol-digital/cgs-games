const { globSync } = require('tinyglobby');

// Next's getRootDirs uses only globSync(pattern, { onlyDirectories: true }).
// tinyglobby expands literal directories recursively by default; fast-glob does not.
exports.globSync = (patterns, options) =>
  globSync(patterns, { ...options, expandDirectories: false });
