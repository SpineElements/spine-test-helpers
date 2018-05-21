/*
  ~ Copyright (c) 2000-2018 TeamDev. All rights reserved.
  ~ TeamDev PROPRIETARY and CONFIDENTIAL.
  ~ Use is subject to license terms.
  */

/*
  This module provides the utilities for testing custom elements.

  The functions in this file assume that the [Chai Assertion Library](http://www.chaijs.com/)
  library is available where these methods are used (it is already provided with Web Component
  Tester if you're writing Polymer element tests).
*/

/**
 * Wait for the specified condition asynchronously (with a chain of `setTimeout` invocations),
 * and invokes the provided completion callback when the condition is met. If the condition is
 * not met within the period defined by the `timeoutMillis` parameter then an assertion error is
 * reported.
 *
 * A condition is specified as a function, which can return `true` or `undefined` to signify
 * that the condition is fulfilled, and return `false` or throw an exception to signify that the
 * condition is not fulfilled.
 *
 * The passed completion callback can either be invoked synchronously (if a condition is met
 * when the function is invoked), or asynchronously, if a condition is fulfilled later.
 *
 * This function throws an exception if the specified condition wasn't fulfilled during the
 * configured timeout period (see the `timeoutMillis` parameter).
 *
 * @param {function(): boolean|undefined} condition
 *                A function that checks the condition. It can return `true` or `undefined` if
 *                the condition is fulfilled, and `false` if it still has to be waited for. If
 *                a function throws any exception, this is treated in the same way as if the
 *                function returned `false`.
 * @param {function}    completionCallback
 *                A function that is invoked when the condition is met.
 * @param {string=}     description
 *                An optional description that will be included into the timeout waiting failure
 *                message.
 * @param {number=2000} timeoutMillis
 *                A maximum period in milliseconds that the condition should be waited for.
 *
 * @throws An exception if the condition couldn't be fulfilled in the allotted timeout period.
 */
export function waitForCondition(condition,
    completionCallback,
    description,
    timeoutMillis = 2000) {
  const deadline = Date.now() + timeoutMillis;

  let lastFailureDescription = null;
  const descriptionPrefix = description ? `${description}: ` : '';
  function waitFor_internal(condition, completionCallback) {
    if (Date.now() > deadline) {
      const lastFailureInfo = lastFailureDescription
          ? `Last failure: ${lastFailureDescription}`
          : '';
      assert.fail('Fulfilled in time', 'Condition',
          descriptionPrefix +
          `Timed out waiting for a condition (in ${timeoutMillis}ms). ${lastFailureInfo}`);
    }
    let stopWithException = null;
    try {
      const conditionEvaluationResult = condition();
      if (conditionEvaluationResult === true || conditionEvaluationResult === undefined) {
        completionCallback();
        return;
      }
      if (conditionEvaluationResult !== false) {
        stopWithException = new Error(
            `${descriptionPrefix}A function passed to waitForCondition has to return either ` +
            'a boolean value or undefined, but the following value with a type of ' +
            `${typeof conditionEvaluationResult} was returned: ${conditionEvaluationResult}`);
      }
    } catch(e) {
      // waiting for condition() to complete without throwing an exception
      lastFailureDescription =
          e instanceof Error ? e.message :
          e.constructor      ? `[${e.constructor.name}]` :
                               `[${typeof e}]`;
    }

    if (stopWithException) {
      throw stopWithException;
    }

    setTimeout(() => waitFor_internal(condition, completionCallback), 20);
  }

  waitFor_internal(condition, completionCallback);
}

/**
 * Runs the specified list of functions with an asynchronous delay between each of them.
 *
 * If an exception occurs in any of the functions, the successive functions in the list won't be
 * invoked. The first function in this list is run synchronously when this function is invoked.
 *
 * @param {{interval: number=0, retryTimeout: number=0}}  params
 *             parameters that define the rules of executing the asynchronous invocation chain:
 *             - `interval` defines a number of milliseconds that should elapse before the next
 *               function is invoked. A value of 0 (a default value) still makes functions
 *               calls to be separated with an asynchronous delay (albeit a minimal one).
 *             - `retryTimeout` specifies a number of milliseconds that each function should be
 *               retried in, if its invocation throws an exception. A value of 0 (a default
 *               value) means that each function will be invoked only once without additional
 *               retries.
 * @param {function} functions
 *             functions that should be invoked
 */
export function runAsyncChain(params, ...functions) {
  if (functions.length === 0) {
    return;
  }

  const interval = params.interval || 0;
  const invokeNextAsyncFunction = () => {
    setTimeout(() => {
      runAsyncChain(params, ...functions.slice(1));
    }, interval);
  };

  const retryTimeout = params.retryTimeout || 0;
  if (retryTimeout === 0) {
    functions[0]();
    invokeNextAsyncFunction();
  } else {
    waitForCondition(() => {
      functions[0]();
    }, invokeNextAsyncFunction, retryTimeout);
  }
}

/**
 * Contains constants for the standard node names
 * (https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeName).
 */
export const NodeNames = {
  TEXT: '#text',
  COMMENT: '#comment'
};

/**
 * A collection of functions that accept a `Node` reference as a parameter and returns `true` or
 * `false` depending on whether a condition specific to each individual method is met or not.
 */
export const NodePredicates = {
  isWhitespaceOnlyTextNode: node => (
      node.nodeName === NodeNames.TEXT &&
      node.data.trim() === ''
  ),
  isCommentNode: node => (
      node.nodeName === NodeNames.COMMENT
  ),
  isDisplayNoneElement: node => (
      node instanceof Element &&
      getComputedStyle(node).display === 'none'
  ),
  isDisplayedNode: node => (
      !NodePredicates.isWhitespaceOnlyTextNode(node) &&
      !NodePredicates.isCommentNode(node) &&
      !NodePredicates.isDisplayNoneElement(node)
  )
};

/**
 * Checks the list of nodes using the list of checkers — one checker for each node.
 *
 * A "checker" here is a function that accepts two parameters (`node: Node`, `message: string`),
 * and runs assertions for any criteria that the respective node should fulfill. If the passed
 * node passes all checks then the checker function should return without exceptions.
 *
 * The passed list of nodes is filtered to skip all whitespace-only text nodes, comment nodes,
 * and nodes whose `display` CSS property has a value of `none` (as defined by the logic in
 * `NodePredicates.isDisplayed()` function). This default filtering behavior can be changed
 * using the `nodeFilter` parameter. The checkers passed to this function will be applied to
 * the filtered list.
 *
 * Checker implementations are encouraged to include the `message` passed to them into
 * the actual assertion messages so that a higher level assertion context is clear in the
 * resulting messages.
 *
 * @param {Array<Node>} nodes
 *                  An array (or array-like or iterable object) of nodes that should be checked.
 * @param {function(Node):boolean=} nodeFilter
 *                  A function, which can optionally be specified in order to change the default
 *                  node filtering behavior. If `null` or `undefined` is passed then
 *                  `NodePredicates.isDisplayed` is used as a default filter.
 * @param {Array<function(Node,string)>} expectedNodeCheckers
 *                  An array of checker functions, whose length is expected to be the same as
 *                  the number of nodes that satisfy the filtering criteria according to
 *                  `nodeFilter` value being used.
 * @param {string} message
 *                  An optional message that will be used in assertions performed by this
 *                  method, and passed to the respective checkers.
 */
export function checkNodeList(nodes, nodeFilter, expectedNodeCheckers, message) {
  if (!nodeFilter) {
    nodeFilter = NodePredicates.isDisplayedNode;
  }
  const messagePrefix = message ? `${message}: ` : '';
  if (!expectedNodeCheckers) {
    assert.equal(nodes.length, 0, `${messagePrefix}expecting nodes list to be empty.`);
    return;
  }
  const filteredNodes = Array.from(nodes).filter(nodeFilter);
  assert.equal(filteredNodes.length, expectedNodeCheckers.length,
      `${messagePrefix}checking the number of nodes`);
  filteredNodes.forEach((node, index) => {
    const expectedNodeChecker = expectedNodeCheckers[index];
    expectedNodeChecker(node,
        `${messagePrefix}checking node number ${index} (nodeName='${node.nodeName}')`);
  });
  return filteredNodes;
}

/**
 * A collection of functions that create checkers of various kinds.
 *
 * A "checker" here is a function that accepts two parameters (`node: Node`, `message: string`),
 * and checks the specified node for any criteria that are specific for this type of checker
 * using the assertion functions. So if element checking fails, an appropriate assertion
 * exception is thrown, and if all checks are passed then the function returns without
 * exceptions. The `message` parameter provides a text that should be included into the actual
 * assertion messages.
 */
export const Checkers = Object.assign(window.Checkers || {}, {
  /**
   * Creates a checker that checks whether a node that it is given is an element that that
   * satisfies the criteria passed in the `params` argument.
   *
   * @param {{
   *    name: string|undefined,
   *    className: string|undefined,
   *    innerHTML: string|undefined,
   *    innerText: string|undefined,
   *    childNodeCheckers: Array<function>|undefined,
   *    filteredChildNodeCheckers: Array<{filter:function,checkers:Array<function>}>|undefined,
   *    slots: Object|undefined,
   *    properties: Object|undefined,
   *    computedStyle: Object|undefined,
   *    borderBox: Object|undefined
   *  }} params  a hash whose properties defines which checks should be performed on a node:
   *    - `name` makes the element's tag name to be checked. Lower-case tag name is expected
   *             here.
   *    - `className` makes the element's `className` property to be checked against the
   *             specified string.
   *    - `hasClassNames` ensures that each of the provided CSS class names in the array are
   *             present in the element's class list. This option is different from the
   *             `className` one in that `className` checks for strict `className` property
   *             correspondence, and `hasClassNames` ensures the presence of some class(es)
   *             without checking if there are any other classes applied to the element.
   *    - `innerHTML` makes the element's trimmed `innerHTML` property to be checked against the
   *             specified string.
   *    - `innerText` makes the element's trimmed `innerText` property to be checked against the
   *             specified string.
   *    - `childNodeCheckers` makes the element's displayed nodes to be checked with the
   *             provided array of checkers (see the `checkNodeList` function for details, which
   *             is used to perform the actual checks). Note that only the nodes that pass the
   *             `NodePredicates.isDisplayedNode` filter are checked. Similar to
   *             `checkNodeList`, accepts an array of checker functions, one per each expected
   *             node.
   *    - `filteredNodeCheckers` is the same as `childNodeCheckers`, but it checks a list of
   *             child nodes filtered according to the provided filter. In fact, it can check
   *             sets of child nodes filtered in different ways by different filters, passed
   *             here. Instead of accepting an array of checkers, it accepts an array of entries
   *             where each entry is an object having two fields: `filter` (a function that
   *             filters nodes), and `checkers` (an array of checkers that is used to check
   *             the filtered list of child nodes — one checker per each expected node).
   *    - `slots` accepts a hash that allows to run checkers on elements assigned to specific
   *             slots. Each key name in the provided hash should be the same as the slot name
   *             to be checked, and the respective value should contain a checker function that
   *             should be run on an element assigned to that slot. Passing `null` as a value
   *             results in an assertion that ensures that there's no element assigned to that
   *             slot.
   *    - `properties` accepts a hash of property name -> property value pairs that should be
   *             checked using the `assert.equal` for the respective element(s).
   *    - `computedStyle` — a hash of CSS property name -> CSS property value paris that are
   *             expected to be applied on the checked element(s) (actual CSS property values
   *             are detected using the `Window.getComputedStyle()` method).
   *    - `borderBox` — a hash of property name -> property value pairs that should be checked
   *             against element's border box (which is obtained using the
   *             `Element.getBoundingClientRect()` method). A key can be one of: `left`, `top`,
   *             `right`, `bottom`, `width`, or `height`, and a value should be a number that
   *             the respective property is expected to be equal to. Dimensions that are off by
   *             up to 0.5 pixels are considered equal by this method.
   *    - `checkers` — an array of checker functions that should be run for the node.
   *
   * @returns {function(node: Node, message: string)}
   */
  element: (params) => (node, message) => {
    const messagePrefix = message ? `${message}: ` : '';
    assert.isOk(node, '${messagePrefix}a node reference must be provided');
    assert.isTrue(node instanceof Element,
        `${messagePrefix}checking that the passed node is an ` +
        `instance of Element (node.nodeName = '${node.nodeName}'`);
    if (params.name !== undefined) {
      assert.equal(node.tagName.toLowerCase(), params.name,
          `${messagePrefix}checking element's tag name`);
    }
    if (params.className !== undefined) {
      assert.equal(node.className || '', params.className || '',
          `${messagePrefix}checking element's class name`);
    }
    if (params.hasClassNames !== undefined) {
      params.hasClassNames.forEach(className => {
        assert.isTrue(node.classList.contains(className),
            `${messagePrefix}checking element contains class "${className}"`);
      });
    }
    if (params.innerHTML !== undefined) {
      assert.equal(node.innerHTML.trim(), params.innerHTML,
          `${messagePrefix}checking element's innerHTML`);
    }
    if (params.innerText !== undefined) {
      assert.equal(node.innerText.trim(), params.innerText,
          `${messagePrefix}checking element's innerText`);
    }
    if (params.childNodeCheckers !== undefined) {
      checkNodeList(node.childNodes, null, params.childNodeCheckers,
          `${messagePrefix}checking child nodes`);
    }
    if (params.filteredChildNodeCheckers !== undefined) {
      params.filteredChildNodeCheckers.forEach((entry, i) => {
        const nodeFilterFunction = entry.filter;
        checkNodeList(node.childNodes, nodeFilterFunction, entry.checkers,
            `${messagePrefix}checking filtered child nodes (filter index: ${i})`);
      });
    }
    if (params.slots !== undefined) {
      Object.keys(params.slots).forEach(slotName => {
        const elementChecker = params.slots[slotName];
        const elementAssignedToSlot = node.querySelector(`*[slot="${slotName}"]`);
        if (elementChecker) {
          assert.isOk(elementAssignedToSlot,
              `${messagePrefix}checking element existence with attribute slot="${slotName}"`);
          elementChecker(elementAssignedToSlot,
              `${messagePrefix}checking element with attribute slot="${slotName}"`);
        } else {
          assert.isNull(elementAssignedToSlot,
              `${messagePrefix}ensuring that there's no element with ` +
              `attribute slot="${slotName}"`);
        }
      });
    }
    if (params.properties !== undefined) {
      Object.keys(params.properties).forEach(propertyName => {
        assert.equal(node[propertyName], params.properties[propertyName],
            `${messagePrefix}checking property '${propertyName}'`);
      });
    }
    if (params.computedStyle !== undefined) {
      const style = getComputedStyle(node);
      Object.keys(params.computedStyle).forEach(propertyName => {
        assert.equal(style[propertyName], params.computedStyle[propertyName],
            `${messagePrefix}checking CSS property '${propertyName}'`);
      });
    }
    if (params.borderBox !== undefined) {
      const rect = node.getBoundingClientRect();
      Object.keys(params.borderBox).forEach(paramName => {
        const expectedParamValue = params.borderBox[paramName];
        const actualParamValue = rect[paramName];
        assert.approximately(actualParamValue, expectedParamValue, 0.5,
            `${messagePrefix}checking the borderBox['${paramName}'] value`);
      });
    }
    const checkers = params.checkers;
    if (checkers !== undefined) {
      if (!(checkers instanceof Array)) {
        throw Error('`checkers` should be an array, but was: ' +
            (checkers.constructor ? checkers.constructor.name : checkers)
        );
      }
      checkers.forEach((checkerFunction, checkerIndex) => {
        if (typeof checkerFunction !== 'function') {
          throw Error(
              `Each entry in the \`checkers\` array should be a function: ${checkerFunction}`);
        }
        checkerFunction(node, `${messagePrefix}running checker #${checkerIndex}`);
      });
    }
  },

  /**
   * Creates a checker that ensures that the passed node is a text node with the specified text.
   *
   * @param {string} text
   * @returns {function(node: Node, message: string)}
   */
  textNode: text => (node, message) => {
    const messagePrefix = message ? `${message}: ` : '';
    assert.isOk(node, '${messagePrefix}a node reference must be provided');
    assert.equal(node.nodeName, NodeNames.TEXT,
        `${messagePrefix}expecting a text node (with text "${text}"), ` +
        `but encountered a node named ${node.nodeName}`);
    const trimmedText = node.data.trim();
    assert.equal(trimmedText, text, `${messagePrefix}checking the text node's content`);
  }
});