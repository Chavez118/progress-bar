import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressBar } from '../src/index.js';

class FakeStream {
  constructor({ isTTY = false } = {}) {
    this.isTTY = isTTY;
    this.chunks = [];
  }
  write(chunk) {
    this.chunks.push(chunk);
    return true;
  }
  text() {
    return this.chunks.join('');
  }
}

test('constructor validates stream', () => {
  assert.throws(() => new ProgressBar({ stream: null, total: 10 }), /required/);
  assert.throws(() => new ProgressBar({ stream: { write: 5 }, total: 10 }), /write/);
});

test('constructor validates total', () => {
  const s = new FakeStream();
  assert.throws(() => new ProgressBar({ stream: s, total: -1 }), /non-negative/);
  assert.throws(() => new ProgressBar({ stream: s, total: NaN }), /non-negative/);
  assert.throws(() => new ProgressBar({ stream: s, total: Infinity }), /non-negative/);
});

test('constructor validates width', () => {
  const s = new FakeStream();
  assert.throws(() => new ProgressBar({ stream: s, total: 10, width: 0 }), /positive/);
  assert.throws(() => new ProgressBar({ stream: s, total: 10, width: -5 }), /positive/);
});

test('quiet mode emits one line per update ending in newline', () => {
  const s = new FakeStream({ isTTY: false });
  const bar = new ProgressBar({ stream: s, total: 4, width: 4, description: 'load' });
  bar.update(1);
  bar.update(1);
  bar.update(2);
  const lines = s.text().split('\n').filter(Boolean);
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'load [#---]  25%');
  assert.equal(lines[1], 'load [##--]  50%');
  assert.equal(lines[2], 'load [####] 100%');
});

test('interactive mode uses carriage return and no newline', () => {
  const s = new FakeStream({ isTTY: true });
  const bar = new ProgressBar({ stream: s, total: 4, width: 4 });
  bar.update(1);
  bar.update(1);
  const text = s.text();
  assert.ok(!text.includes('\n'), 'interactive output should contain no newline');
  assert.ok(text.startsWith('\r'), 'each interactive render should be preceded by \r');
  const parts = text.split('\r').filter(Boolean);
  assert.equal(parts.length, 2);
  assert.equal(parts[0], '[#---]  25%');
  assert.equal(parts[1], '[##--]  50%');
});

test('render returns current bar without writing', () => {
  const s = new FakeStream();
  const bar = new ProgressBar({ stream: s, total: 10, width: 10, description: 'task' });
  assert.equal(bar.render(), 'task [----------]  0%');
  bar.update(5);
  assert.equal(bar.render(), 'task [#####-----]  50%');
});

test('total of zero renders as full', () => {
  const s = new FakeStream();
  const bar = new ProgressBar({ stream: s, total: 0, width: 3 });
  bar.update(0);
  assert.equal(s.text().trim(), '[###] 100%');
});

test('update clamps to total and ignores post-finish updates', () => {
  const s = new FakeStream();
  const bar = new ProgressBar({ stream: s, total: 2, width: 2 });
  bar.update(5);
  bar.finish();
  const before = s.text();
  bar.update(1);
  assert.equal(s.text(), before, 'updates after finish are ignored');
  assert.ok(before.trim().endsWith('[##] 100%'));
});

test('finish on incomplete interactive bar emits newline', () => {
  const s = new FakeStream({ isTTY: true });
  const bar = new ProgressBar({ stream: s, total: 5, width: 5 });
  bar.update(1);
  bar.finish();
  assert.ok(s.text().endsWith('\n'));
});

test('finish on incomplete quiet bar does not add a second newline', () => {
  const s = new FakeStream({ isTTY: false });
  const bar = new ProgressBar({ stream: s, total: 5, width: 5 });
  bar.update(1);
  const before = s.text();
  bar.finish();
  assert.equal(s.text(), before);
});

test('setValue jumps to an absolute clamped value', () => {
  const s = new FakeStream();
  const bar = new ProgressBar({ stream: s, total: 10, width: 10 });
  bar.setValue(7);
  bar.setValue(99);
  bar.setValue(-3);
  const last = s.text().split('\n').filter(Boolean).pop();
  assert.equal(last, '[----------]  0%');
});

test('custom glyphs are honored', () => {
  const s = new FakeStream();
  const bar = new ProgressBar({
    stream: s,
    total: 2,
    width: 4,
    complete: '>',
    incomplete: '.',
  });
  bar.update(1);
  assert.equal(s.text().trim(), '[>>..]  50%');
});

test('100 percent is rendered without leading space', () => {
  const s = new FakeStream({ isTTY: true });
  const bar = new ProgressBar({ stream: s, total: 1, width: 4 });
  bar.update(1);
  const last = s.text().split('\r').filter(Boolean).pop();
  assert.equal(last, '[####] 100%');
});
