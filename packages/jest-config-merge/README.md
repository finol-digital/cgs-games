# Jest configuration merge adapter

This private package replaces `deepmerge` only for `jest-config`, via the root
development dependency and scoped npm override. It uses `@fastify/deepmerge` to
exclude prototype-related keys when both cloning and merging configuration.

The replacement addresses [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
The affected `deepmerge` versions have no patched release at the time of this
change. Keep the normal `npm audit` gate enabled; remove this adapter when Jest
uses a maintained, patched dependency.

Only the calls verified in Jest 30's `jest-config` are supported:

- `merge(target, source)` for preset globals.
- `merge.all(configs)` for the exported `mergeConfig` helper.

Arrays concatenate, nested objects are cloned, later values take precedence,
and enumerable symbol keys are retained. Custom `deepmerge` options are rejected
so a new caller cannot silently receive different behavior. This is not a
general-purpose replacement for the full `deepmerge` API.

`__tests__/jestMergeDependencies.test.js` checks the dependency scope, both Jest
call sites, merge compatibility, and prototype-poisoning inputs.
