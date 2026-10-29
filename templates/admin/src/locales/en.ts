import core from './en/core.json';
import login from './en/login.json';
import filters from './en/filters.json';
import errors from './en/errors.json';
import designKits from './en/designKits.json';
import design from './en/design.json';
import forms from './en/forms.json';
import settings from './en/settings.json';
import audit from './en/audit.json';
import status from './en/status.json';

/**
 * Every area file of this language, merged (lazy areas live in `./lazy`). A new area = a new file here and in the
 * other language. Gallery strings (areas `design`, `designKits`) exist only in dev builds: the flag is a
 * compile-time constant, so prod bundles drop them. The type stays complete for the code that renders the gallery.
 */
const gallery = (__SHOW_DESIGN_SYSTEM__ ? { ...design, ...designKits } : {}) as typeof design &
  typeof designKits;

const en = {
  ...core,
  ...login,
  ...errors,
  ...filters,
  ...gallery,
  ...forms,
  ...status,
  ...audit,
  ...settings,
};

export default en;
