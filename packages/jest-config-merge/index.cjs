const createMerge = require('@fastify/deepmerge');

const merge = createMerge({ symbols: true });

/** Implements the two-argument merge used for Jest preset globals. */
function mergeConfig(target, source, options) {
  if (options !== undefined) {
    throw new TypeError('The Jest merge adapter does not support deepmerge options');
  }
  return merge(target, source);
}

/** Implements the array-based merge used by Jest's exported mergeConfig helper. */
mergeConfig.all = function mergeAll(configs, options) {
  if (!Array.isArray(configs)) throw new TypeError('Expected an array of configuration objects');
  if (options !== undefined) {
    throw new TypeError('The Jest merge adapter does not support deepmerge options');
  }
  return configs.reduce((target, source) => merge(target, source), {});
};

module.exports = mergeConfig;
