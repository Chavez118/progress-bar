Single-line progress bar for Node.js that renders sensibly whether output goes to a terminal or is redirected to a file.

```js
import { ProgressBar } from 'progress-bar';

const bar = new ProgressBar({
  stream: process.stdout,
  total: 100,
  width: 30,
  description: 'compiling',
});
for (let i = 0; i < 100; i++) bar.update();
bar.finish();
```

Exported names:
- `ProgressBar` (class). Constructor takes `{ stream, total, width?, complete?, incomplete?, description? }`.
- Methods: `update(inc?)`, `setValue(value)`, `render()`, `finish()`.

The problem this solves: a progress bar only works on an interactive terminal because it relies on moving the cursor back and redrawing the same line. When stdout is a pipe or file (CI logs, `node script.js > log.txt`), rewriting the line produces a wall of `1%`, `2%`, `3%` lines. Detecting a TTY from Node without a binding is unreliable, so the trade-off is that the caller decides: any stream object you pass with a truthy `isTTY` property gets interactive in-place redraw (carriage-return, no newline); anything else gets quiet mode, which emits one complete, readable line per update with no cursor control.

The awkward edge: `isTTY` is checked once at construction, not on every write. If you construct the bar with a stream and then pipe it later, the mode will not change. Pass the final stream from the start.
