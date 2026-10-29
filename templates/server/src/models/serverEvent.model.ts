import { Schema, model, type Types } from 'mongoose';
import {
  EVENT_APP_VERSION_MAX_LENGTH,
  EVENT_NAME_MAX_LENGTH,
  EVENT_NAME_PATTERN,
  SERVER_EVENTS_COLLECTION,
} from '../constants/audit';
import { ACTOR_TYPES, PLATFORMS, type ActorType, type Platform } from '../constants/enums';
import { makeAppendOnly } from './appendOnly';

/** One server-side analytics event (docs/BUSINESS_DOMAIN.md §3.7). Append-only. */
export interface ServerEventRaw {
  ts: Date;
  name: string;
  actorType: ActorType;
  actorId?: Types.ObjectId;
  params: Record<string, unknown>;
  platform?: Platform;
  appVersion?: string;
}

const serverEventSchema = new Schema<ServerEventRaw>(
  {
    ts: { type: Date, required: true, default: Date.now },
    name: {
      type: String,
      required: true,
      match: EVENT_NAME_PATTERN,
      maxlength: EVENT_NAME_MAX_LENGTH,
    },
    actorType: { type: String, enum: ACTOR_TYPES, required: true },
    actorId: { type: Schema.Types.ObjectId },
    params: { type: Schema.Types.Mixed, default: {} },
    platform: { type: String, enum: PLATFORMS },
    appVersion: { type: String, maxlength: EVENT_APP_VERSION_MAX_LENGTH },
  },
  { collection: SERVER_EVENTS_COLLECTION },
);
// Dashboards by time and by event name; per-user journeys.
serverEventSchema.index({ ts: -1 });
serverEventSchema.index({ name: 1, ts: -1 });
serverEventSchema.index({ actorId: 1, ts: -1 });
makeAppendOnly(serverEventSchema);

export const ServerEventModel = model<ServerEventRaw>('ServerEvent', serverEventSchema);
