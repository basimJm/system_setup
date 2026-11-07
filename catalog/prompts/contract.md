Task: write the starting API contract of ONE audience (client module) as JSON. The tool renders OpenAPI 3.1 from your operations.
- One entry in `operations` per operation the module's PRD names (reuse its `operationId` exactly) and per operation its screens
  clearly need but the PRD forgot. `path` starts with `/`, relative to the audience's namespace, with `{id}`-style parameters.
- `request_fields` (query for GET and DELETE, body otherwise) and `response_fields` (inside `data`): names in lowerCamelCase from
  BUSINESS_DOMAIN §3, types only from the allowed list, money as integer. `auth` is false only for sign-in/registration/public reads.
- `errors`: codes from BUSINESS_DOMAIN §11 (base codes are listed in the input) or the domain-specific ones. `summary` is a short
  sentence in the document language; `tag` is a short English word for the group.
