import mongoose, { type Connection, type ConnectOptions } from 'mongoose';
import type { AppConfig } from '../../config';
import {
  MONGO_CONNECT_TIMEOUT_MS,
  MONGO_MAX_POOL_SIZE,
  MONGO_MIN_POOL_SIZE,
  MONGO_READINESS_CHECK_NAME,
  MONGO_SERVER_SELECTION_TIMEOUT_MS,
  MONGO_SOCKET_TIMEOUT_MS,
} from '../../constants/database';
import { ExternalServiceError } from '../errors';
import type { ReadinessCheck } from '../health';
import type { Logger } from '../logger';

/**
 * Driver options. Indexes are created automatically outside production only; production builds
 * them explicitly so a deploy never blocks on an index build.
 */
export const buildMongoOptions = (
  config: Pick<AppConfig, 'isProduction'>,
  overrides: ConnectOptions = {},
): ConnectOptions => ({
  serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
  connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
  socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS,
  maxPoolSize: MONGO_MAX_POOL_SIZE,
  minPoolSize: MONGO_MIN_POOL_SIZE,
  autoIndex: !config.isProduction,
  ...overrides,
});

/** Opens the application connection. A failure is logged (without the URI) and typed. */
export const connectMongo = async (
  config: Pick<AppConfig, 'isProduction' | 'mongo'>,
  logger: Logger,
  overrides: ConnectOptions = {},
): Promise<Connection> => {
  mongoose.set('strictQuery', true);
  try {
    const { connection } = await mongoose.connect(
      config.mongo.uri,
      buildMongoOptions(config, overrides),
    );
    connection.on('disconnected', () => {
      logger.warn('mongodb disconnected');
    });
    connection.on('reconnected', () => {
      logger.info('mongodb reconnected');
    });
    logger.info({ database: connection.name }, 'mongodb connected');
    return connection;
  } catch (error) {
    logger.error({ err: error }, 'mongodb connection failed');
    throw new ExternalServiceError({ unavailable: true, cause: error });
  }
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};

/** `/ready` probe: the connection is open and the server answers a ping. */
export const createMongoReadinessCheck = (
  connection: Pick<Connection, 'readyState' | 'db'>,
): ReadinessCheck => ({
  name: MONGO_READINESS_CHECK_NAME,
  check: async () => {
    if (
      connection.readyState !== mongoose.ConnectionStates.connected ||
      connection.db === undefined
    ) {
      throw new Error('mongodb is not connected');
    }
    await connection.db.admin().ping();
  },
});
