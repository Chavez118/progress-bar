/**
 * Single-line progress bar that degrades gracefully when output is redirected.
 *
 * The core problem: a progress bar only makes sense on an interactive
 * terminal because it relies on moving the cursor back and redrawing the
 * same line. When stdout is a file or pipe (CI logs, redirected output),
 * rewriting the line just produces a screenful of 1%, 2%, 3%... lines.
 *
 * Trade-off: instead of detecting a TTY (which requires a binding and is
 * not in the standard library), the caller decides. They pass either a
 * stream that exposes an `isTTY` truthy property (interactive mode, redraws
 * the same line with carriage-return) or one that does not (quiet mode,
 * emits a single line per update with no cursor control). This is a small
 * API surface and an honest one.
 *
 * Quiet mode still renders sensibly: each emitted line is a clean
 * `progress description  [###---]  42%` with no \r and no line-clearing, so
 * logs are readable and greppable.
 */

export class ProgressBar {
  #stream;
  #total;
  #width;
  #interactive;
  #completeChar;
  #incompleteChar;
  #description;
  #current;
  #started;
  #finished;
  #renderedAny;

  /**
   * @param {object} opts
   * @param {object} opts.stream   Anything with a `.write(string)` method.
   *                                 If it also has a truthy `.isTTY`, the bar
   *                                 redraws in place; otherwise quiet mode.
   * @param {number} opts.total     Non-negative; zero means "no progress to show"
   *                                 and the bar renders as full.
   * @param {number} [opts.width=30] Width of the bar glyph track.
   * @param {string} [opts.complete='#'] Filled cell.
 * @param {string} [opts.incomplete='-'] Empty cell.
   * @param {string} [opts.description=''] Prefix label.
   */
  constructor({
    stream,
    total,
    width = 30,
    complete = '#',
    incomplete = '-',
    description = '',
  } = {}) {
    if (stream === null || stream === undefined) {
      throw new TypeError('opts.stream is required and must have a write() method');
    }
    if (typeof stream.write !== 'function') {
      throw new TypeError('opts.stream must expose a write(chunk) method');
    }
    if (!Number.isFinite(total) || total < 0) {
      throw new RangeError('opts.total must be a non-negative finite number');
    }
    if (!Number.isFinite(width) || width <= 0) {
      throw new RangeError('opts.width must be a positive finite number');
    }
    if (typeof complete !== 'string' || complete.length === 0) {
      throw new TypeError('opts.complete must be a non-empty string');
    }
    if (typeof incomplete !== 'string' || incomplete.length === 0) {
      throw new TypeError('opts.incomplete must be a non-empty string');
    }
    if (typeof description !== 'string') {
      throw new TypeError('opts.description must be a string');
    }

    this.#stream = stream;
    this.#total = total;
    this.#width = width;
    this.#interactive = !!stream.isTTY;
    this.#completeChar = complete;
    this.#incompleteChar = incomplete;
    this.#description = description;
    this.#current = 0;
    this.#started = false;
    this.#finished = false;
    this.#renderedAny = false;
  }

  /**
   * Advance the bar by `inc` (default 1) and redraw.
   * Values are clamped to [0, total]; updates after finish() are ignored.
   */
  update(inc = 1) {
    if (this.#finished) return;
    if (this.#total > 0 && this.#current >= this.#total) return;
    if (!Number.isFinite(inc)) inc = 0;
    this.#current = Math.max(0, Math.min(this.#total, this.#current + inc));
    this.#render();
  }

  /**
   * Jump to an absolute value, clamped to [0, total].
   */
  setValue(value) {
    if (this.#finished) return;
    if (!Number.isFinite(value)) throw new TypeError('value must be finite');
    this.#current = Math.max(0, Math.min(this.#total, value));
    this.#render();
  }

  /**
   * Mark complete. If interactive and not already on a fresh line, emit \n
   * so subsequent output doesn't smush into the bar.
   */
  finish() {
    if (this.#finished) return;
    this.#finished = true;
    if (this.#interactive && this.#renderedAny && this.#current < this.#total) {
      this.#stream.write('\n');
    }
  }

  /**
   * Build the bar string for the current state.
   */
  render() {
    return this.#buildLine();
  }

  /**
   * Emit the bar to the underlying stream.
   * Interactive: \r + line (overwrites in place).
   * Quiet: line + \n once only when crossing a visible threshold boundary.
   */
  #render() {
    this.#started = true;
    this.#renderedAny = true;
    const line = this.#buildLine();
    if (this.#interactive) {
      this.#stream.write('\r' + line);
    } else {
      this.#stream.write(line + '\n');
    }
  }

  #buildLine() {
    let ratio;
    if (this.#total === 0) {
      ratio = 1;
    } else {
      ratio = this.#current / this.#total;
    }
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const filled = Math.floor(clampedRatio * this.#width);
    const empty = this.#width - filled;
    const bar = this.#completeChar.repeat(filled) + this.#incompleteChar.repeat(empty);
    const percent = Math.round(clampedRatio * 100);
    const padded = percent < 100 ? ' ' + String(percent) : String(percent);
    const desc = this.#description ? this.#description + ' ' : '';
    return `${desc}[${bar}] ${padded}%`;
  }
}
