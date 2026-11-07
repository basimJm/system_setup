import { Fake__SDK_TITLE__Port } from './adapters/fake';
import { resolveConfig, type __SDK_TITLE__Options } from './config/options';
import { __SDK_TITLE__Service } from './service';
import type { __SDK_TITLE__Port } from './types';

/** A client plus the port it runs on (the fake port exposes what was executed). */
export interface Created__SDK_TITLE__ extends __SDK_TITLE__Service {
  readonly port: __SDK_TITLE__Port;
}

/** The factory: `fake` runs on the recording port; `custom` on the injected adapter. */
export const create__SDK_TITLE__ = (options: __SDK_TITLE__Options): Created__SDK_TITLE__ => {
  const config = resolveConfig(options);
  // resolveConfig refuses `custom` without a port and a fake port in prod, so the fallback is dev-only.
  const port = config.port ?? new Fake__SDK_TITLE__Port();
  return Object.assign(new __SDK_TITLE__Service(config, port), { port });
};
