# requirefire

A userland re-implementation of `require` for node.js. Useful in situations where you need a separate require cache and loader that can be intricately managed in tests.

## See Also

- [rewire](https://github.com/jhnns/rewire). `requirefire` is different in that it overrides transitive requires, caches modules for the same instance, can have multiple instances, and doesn't support monkeypatching
- [proxyquire](https://github.com/thlorenz/proxyquire). `requirefire` is different in that it can have multiple instances, doesn't support monkeypatching, but doesn't need any explicit stubs for required modules

## Credits

Most of this code is from the [rewire](https://github.com/jhnns/rewire) module, but adjusted to work against a stateful instance with a require cache, and less oriented at monkeypatching. Thanks to Johannes for his hard work!
