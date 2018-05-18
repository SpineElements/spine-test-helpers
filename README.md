# spine-test-helpers

A set of utilities that simplify the creation of custom element tests.

Contains the following files that can be imported independently:
- `spine-test-helpers.js` — the main package with the testing utilities;
- `test-delayed.js` — provides the `testDelayed` function, that can be used instead of 
  Web Component Tester's `test` function to run a test after a delay (delegates execution to the 
  `test` function asynchronously).

# License

Apache License

Version 2.0, January 2004
