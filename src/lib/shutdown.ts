import type { Logger } from 'winston';
import type { Server } from 'node:http';
import { type AppUtility } from '../types/common.ts';

/**
 * Function to shutdown the process, exit code 1 if the shutdown is not graceful.
 */
function shutdown(logger: Logger, server: Server) {
    logger.info('Shutting down server');

    try {
        server.close();
        process.exit(0);
    } catch (err: unknown) {
        logger.error('Error shutting down server:', err);
        process.exit(1);
    }
}

export function registerShutdownEventHandlers(
    appUtility: AppUtility,
    server: Server,
) {
    const { logger } = appUtility;
    process.on('SIGINT', () => shutdown(logger, server));
    process.on('SIGTERM', () => shutdown(logger, server));
}
