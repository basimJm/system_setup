import { DEFAULTS, EVENT_NAME_PATTERN, ID_PATTERN } from './constants/analytics';
import { validationError } from './errors';
import type { AnalyticsEvent, IdentityLink, Properties } from './types';

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const assertId = (value: string | undefined, name: string): void => {
  if (value !== undefined && (!isText(value) || !ID_PATTERN.test(value)))
    throw validationError(`${name} has an invalid shape`);
};

const assertProperties = (properties: Properties | undefined): void => {
  if (properties === undefined) return;
  for (const [key, value] of Object.entries(properties))
    if (!isText(key) || (value !== null && !['string', 'number', 'boolean'].includes(typeof value)))
      throw validationError('properties must be flat string/number/boolean/null values');
  if (Buffer.byteLength(JSON.stringify(properties)) > DEFAULTS.maxPropertiesBytes)
    throw validationError('properties exceed the size limit');
};

export const assertEvent = (event: AnalyticsEvent): void => {
  if (!isText(event.name) || !EVENT_NAME_PATTERN.test(event.name))
    throw validationError('name must be snake_case (2-64 chars)');
  assertId(event.userId, 'userId');
  assertId(event.anonymousId, 'anonymousId');
  if (event.userId === undefined && event.anonymousId === undefined)
    throw validationError('an event needs a userId or an anonymousId');
  assertProperties(event.properties);
  if (event.occurredAt !== undefined && Number.isNaN(event.occurredAt.getTime()))
    throw validationError('occurredAt must be a valid date');
};

export const assertLink = (link: IdentityLink): void => {
  if (!isText(link.anonymousId) || !isText(link.userId))
    throw validationError('a link needs both anonymousId and userId');
  assertId(link.anonymousId, 'anonymousId');
  assertId(link.userId, 'userId');
};
