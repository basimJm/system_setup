import type { Model } from 'mongoose';
import { ServerEventModel, type ServerEventRaw } from '../models/serverEvent.model';
import type { EventCountQuery, EventCountRow } from '../providers/analytics/types';
import { AppendOnlyRepository } from './appendOnly.repository';

export class ServerEventsRepository extends AppendOnlyRepository<ServerEventRaw> {
  constructor(model: Model<ServerEventRaw> = ServerEventModel) {
    super(model);
  }

  /** Event counts in `[from, to)` grouped by name or by local day (`timeZone`). */
  async countGrouped(query: EventCountQuery): Promise<EventCountRow[]> {
    const match: Record<string, unknown> = { ts: { $gte: query.from, $lt: query.to } };
    if (query.names !== undefined && query.names.length > 0) match.name = { $in: [...query.names] };
    const key =
      query.groupBy === 'NAME'
        ? '$name'
        : { $dateToString: { format: '%Y-%m-%d', date: '$ts', timezone: query.timeZone } };
    const rows = await this.model
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $group: { _id: key, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((row) => ({ key: row._id, count: row.count }));
  }
}
