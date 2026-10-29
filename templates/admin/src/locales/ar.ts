import core from './ar/core.json';
import login from './ar/login.json';
import filters from './ar/filters.json';
import errors from './ar/errors.json';
import designKits from './ar/designKits.json';
import design from './ar/design.json';
import forms from './ar/forms.json';
import settings from './ar/settings.json';
import audit from './ar/audit.json';
import status from './ar/status.json';

/**
 * Every area file of this language, merged (lazy areas live in `./lazy`). A new area = a new file here and in the
 * other language. Gallery strings (areas `design`, `designKits`) exist only in dev builds: the flag is a
 * compile-time constant, so prod bundles drop them. The type stays complete for the code that renders the gallery.
 */
const gallery = (__SHOW_DESIGN_SYSTEM__ ? { ...design, ...designKits } : {}) as typeof design &
  typeof designKits;

const ar = {
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

export default ar;
