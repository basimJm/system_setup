import type { Request, Response } from 'express';
import { SUCCESS_MESSAGE_KEYS } from '../../constants/messages';
import { HTTP_STATUS } from '../../constants/http';
import type { MessageParams } from '../errors';
import { buildPaginationMeta, type PaginationMeta, type PaginationParams } from '../pagination';

/** Base success response (CLAUDE.md §6). `meta` only appears on paginated lists. */
export interface SuccessResponseBody<T> {
  readonly success: true;
  readonly message: string;
  readonly data: T | null;
  readonly meta?: PaginationMeta;
}

export interface SuccessOptions {
  readonly data?: unknown;
  readonly messageKey?: string;
  readonly messageParams?: MessageParams;
  readonly status?: number;
  readonly meta?: PaginationMeta;
}

/** Writes the success envelope. Controllers must use this instead of `res.json(...)`. */
export const sendSuccess = (
  req: Request,
  res: Response,
  { data, messageKey, messageParams, status = HTTP_STATUS.ok, meta }: SuccessOptions = {},
): void => {
  const body: SuccessResponseBody<unknown> = {
    success: true,
    message: req.t(messageKey ?? SUCCESS_MESSAGE_KEYS.ok, messageParams),
    data: data ?? null,
    ...(meta === undefined ? {} : { meta }),
  };
  res.status(status).json(body);
};

/** 201 response for a created resource. */
export const sendCreated = (
  req: Request,
  res: Response,
  data: unknown,
  messageKey: string = SUCCESS_MESSAGE_KEYS.created,
): void => {
  sendSuccess(req, res, { data, messageKey, status: HTTP_STATUS.created });
};

/** Paginated list: items in `data`, `{ page, pageSize, total }` in `meta`. */
export const sendPaginated = (
  req: Request,
  res: Response,
  items: readonly unknown[],
  params: PaginationParams,
  total: number,
): void => {
  sendSuccess(req, res, { data: items, meta: buildPaginationMeta(params, total) });
};
