'use strict';

const BroccoliTestHelper = require('broccoli-test-helper');
const buildOutput = BroccoliTestHelper.buildOutput;
const createTempDir = BroccoliTestHelper.createTempDir;
const co = require('co');

const BroccoliConditionalDebug = require('../src');

const describe = QUnit.module;
const it = QUnit.test;

describe('BroccoliConditionalDebug', function(hooks) {
  let fixture, input, debug;

  hooks.beforeEach(co.wrap(function* () {
    input = yield createTempDir();
    debug = yield createTempDir();

    process.env.BROCCOLI_DEBUG_PATH = debug.path();

    fixture = {
      'foo.txt': 'baas',
      'derp': {
        'lol': {
          'ha!': 'hehe'
        }
      }
    };
  }));

  hooks.afterEach(co.wrap(function* () {
    yield input.dispose();
    yield debug.dispose();

    delete process.env.BROCCOLI_DEBUG_PATH;
    delete process.env.BROCCOLI_DEBUG;
  }));

  describe('BroccoliConditionalDebug.buildDebugCallback', function() {
    it('returns a callback that builds debug trees with a consistent prefix', function(assert) {
      process.env.BROCCOLI_DEBUG = '*';

      let debugTree = BroccoliConditionalDebug.buildDebugCallback('foo-addon');

      let tree1 = debugTree(input.path(), 'addon-tree');
      assert.equal(tree1.debugLabel, 'foo-addon:addon-tree');

      let tree2 = debugTree(input.path(), 'vendor-tree');
      assert.equal(tree2.debugLabel, 'foo-addon:vendor-tree');
    });

    it('returns the input tree if debug flag does not match label', co.wrap(function* (assert) {
      input.write(fixture);
      let inputPath = input.path();

      let debugTree = BroccoliConditionalDebug.buildDebugCallback('foo-bar');
      let subject = debugTree(inputPath, 'derp');

      assert.equal(subject, inputPath, 'is equal to the input because the label does not match the BROCCOLI_DEBUG flag');

      let output = yield buildOutput(subject);

      assert.deepEqual(output.read(), fixture, 'final output matches input');
      assert.deepEqual(debug.read(), { }, 'debug tree output is empty');
    }));

    it('returns a BroccoliConditionalDebug tree when the BROCCOLI_DEBUG flag matches the label', co.wrap(function* (assert) {
      input.write(fixture);
      let inputPath = input.path();

      process.env.BROCCOLI_DEBUG = 'foo-bar:herp';

      let debugTree = BroccoliConditionalDebug.buildDebugCallback('foo-bar');
      let subject = debugTree(inputPath, 'herp');

      assert.notEqual(subject, inputPath, 'tree2 does not match input because the label matches the BROCCOLI_DEBUG flag');
      assert.ok(subject instanceof BroccoliConditionalDebug, 'tree2 is a BroccoliConditionalDebug instance');

      let output = yield buildOutput(subject);

      assert.deepEqual(output.read(), fixture, 'final ouptut matches input');
      assert.deepEqual(debug.read(), { 'foo-bar:herp': fixture }, 'debug tree output matches input');
    }));
  });

  it('should pass through', co.wrap(function* (assert) {
    input.write(fixture);

    let node = new BroccoliConditionalDebug(input.path(), 'test-1');

    let output = yield buildOutput(node);

    assert.deepEqual(output.read(), fixture);
    assert.deepEqual(debug.read(), {});
  }));

  it('should emit a copy of the input into BROCCOLI_DEBUG_PATH', co.wrap(function* (assert) {
    let label = 'test-1';
    input.write(fixture);

    process.env.BROCCOLI_DEBUG = '*';
    let node = new BroccoliConditionalDebug(input.path(), label);

    let output = yield buildOutput(node);

    assert.deepEqual(output.read(), fixture);
    assert.deepEqual(debug.read(), { [label]: fixture });
  }));

  it('clears stale content from debug path', co.wrap(function* (assert) {
    let label = 'test-1';
    input.write(fixture);

    debug.write({
      [label]: {
        'stuff': 'was here'
      }
    });

    process.env.BROCCOLI_DEBUG = '*';
    let node = new BroccoliConditionalDebug(input.path(), label);

    let output = yield buildOutput(node);

    assert.deepEqual(output.read(), fixture);
    assert.deepEqual(debug.read(), { [label]: fixture });
  }));

  describe('shouldSyncDebugDir', function(hooks) {
    hooks.afterEach(function() {
      delete process.env.BROCCOLI_DEBUG;
    });

    function match(options) {
      it(`${options.label} ${options.matches ? 'matches' : 'does not match'} ${options.env}`, function(assert) {
        process.env.BROCCOLI_DEBUG = options.env;
        let result = BroccoliConditionalDebug._shouldSyncDebugDir(options.label);

        assert.equal(result, options.matches);
      });
    }

    match({ label: 'ember-engines:foo-bar:addon-input', matches: true, env: '*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: true, env: 'ember-engines:*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: true, env: 'ember-engines:foo-bar:*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: true, env: 'ember-engines:foo-bar:addon-input'});

    match({ label: 'ember-engines:foo-bar:addon-input', matches: false, env: 'ember-cli:*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: false, env: 'ember:*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: false, env: 'ember-engines:baz-bar:*'});
    match({ label: 'ember-engines:foo-bar:addon-input', matches: false, env: 'ember-engines:foo-bar:addon-output'});
  });
});
