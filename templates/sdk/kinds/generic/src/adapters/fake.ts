import type { __SDK_TITLE__Port, __SDK_TITLE__Request, __SDK_TITLE__Result } from '../types';

const NAME = 'fake';

/** Records requests instead of sending them; `failWith` makes the next calls fail. */
export class Fake__SDK_TITLE__Port implements __SDK_TITLE__Port {
  readonly name = NAME;
  readonly isFake = true;
  readonly executed: __SDK_TITLE__Request[] = [];
  failWith: Error | undefined;

  execute(request: __SDK_TITLE__Request): Promise<__SDK_TITLE__Result> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.executed.push(request);
    return Promise.resolve({ id: `${NAME}-${String(this.executed.length)}`, status: 'DONE' });
  }
}
