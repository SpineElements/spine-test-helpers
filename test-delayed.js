/*
  Copyright (c) 2000-2018 TeamDev Ltd. All rights reserved.
  TeamDev PROPRIETARY and CONFIDENTIAL.
  Use is subject to license terms.
*/

/**
 * Similar to Web Component Tester's `test` function, but runs a test after an
 * asynchronous delay.
 *
 * NOTE: this declaration is intentionally made in a js file and not an html
 * file, since it has to be available when HTML test declarations like `suite()`
 * and `test()` are invoked, which happens earlier than HTMLs are imported on
 * browsers that lack native HTML imports support (like Firefox), which would
 * make the `testDelayed` function to be unavailable at that stage.
 *
 * @param {string} name
 *            Test name
 * @param {function(function()=)} testFunc
 *            Test function, that optionally receives a `done` function. If the
 *            actual function passed doesn't contain the `done` parameter then
 *            async test execution is automatically marked as "done" after this
 *            function completes execution. Otherwise, this function is expected
 *            to invoke the passed `done` function itself.
 * @param {{delay:number=300,flush:boolean=false}=} params
 *            Contains optional parameters:
 *              `delay` — period (in milliseconds) that should be
 *                         waited for before calling the specified test function
 *              `flush` — specifies whether
 */
function testDelayed(name, testFunc, params) {
  const actualParams = Object.assign({}, {delay: 300, flush: false}, params);
  const invokeDelayedTest = done => {
    setTimeout(() => {
      testFunc(done);
      if (testFunc.length === 0) {
        // if a function doesn't accept a "done" parameter, signal async test
        // completion on its behalf
        done();
      }
    }, actualParams.delay);
  };
  test(name, (done) => {
    if (actualParams.flush) {
      flush(() => invokeDelayedTest(done));
    } else {
      invokeDelayedTest(done);
    }
  })
}
