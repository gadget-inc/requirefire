# requirefire

A userland re-implementation of `require` for node.js. Useful in situations where you need a separate require cache and loader that can be intricately managed in tests.

## Why

Sometimes you just have no other option -- and really, thats how this module should be used, as a backup to the backup plan. If you can, you should use plain old `require`. It supports many more things like require extensions, and is way more likely to just work for you.

That said, sometimes it is useful to have a cleanroom implementation of `require` that you know no other systems have messed with. Testing frameworks like `jest` mess with require without much opportunity to change how, so if you need to get around it, you can use `requirefire` for whatever you need finer control over the semantics of. Godspeed on your journey fellow modulonaut.

## Installation

```
npm install requirefire
```

or

```
pnpm add requirefire
```

## Usage

The `requirefire` module exports a factory function which must be called to create a new `require` function. So, import the `createRequirefire` function from the module, and then invoke it to create a new version of `require`.

```typescript
import createRequirefire from "requirefire";

// create a requirefire instance, using this module as the parent module
const requirefire = createRequirefire(module);
```

```typescript
// require a module
const someModule = requirefire("./someModule");

// requiring the module a second time will return the same instance from a cache, same as normal `require`
someModule == requirefire("./someModule"); // true

// requiring a module with requirefire will return a different instance of the same module than normal `require`
someModule == require("./someModule"); // false

// the requirefire instance has a .cache property that can be mutated
delete requirefire.cache["path/to/someModule"];

// once the cache is cleared, requirefire will re-execute the module from disk when required again
const newSomeModule = requirefire("./someModule");
someModule == newSomeModule; // false

// multiple requirefire instances can be created, and each has an independent require cache
const otherRequirefire = createRequirefire();
requirefire("./someModule") == otherRequirefire("./someModule"); // false
```

## See Also

- [rewire](https://github.com/jhnns/rewire). `requirefire` is different in that it overrides transitive requires, caches modules for the same instance, can have multiple instances, and doesn't support monkeypatching
- [proxyquire](https://github.com/thlorenz/proxyquire). `requirefire` is different in that it can have multiple instances, doesn't support monkeypatching, but doesn't need any explicit stubs for required modules

## Credits

Most of this code is from the [rewire](https://github.com/jhnns/rewire) module, but adjusted to work against a stateful instance with a require cache, and less oriented at monkeypatching. Thanks to Johannes for his hard work!
