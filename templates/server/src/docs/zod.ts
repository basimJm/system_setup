import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi()` to zod. Docs files import `z` from here so the extension always runs first.
extendZodWithOpenApi(z);

export { z };
