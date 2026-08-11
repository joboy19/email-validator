import { type AppUtility } from '../types/common.ts';

export function registerErrorEventHandlers(appUtility: AppUtility) {
    const { logger } = appUtility;
    process.on('uncaughtException', (err: Error) => {
        logger.error('Unhandled Error:', err);
    });

    process.on('unhandledRejection', (err: Error) => {
        logger.error('Unhandled Promise Rejection:', err);
    });
}
