import express from 'express';
import winston from 'winston';

import { type AppUtility } from './types/common.ts';
import { registerShutdownEventHandlers } from './lib/shutdown.ts';
import { setupRoutes } from './routes/setup.ts';
import { UploadProcessor } from './lib/upload-repository.ts';
import {
    MockEmailValidation as MockEmailValidator,
    ValidateEmailService,
} from './services/email-validator-service.ts';
import rateLimit from 'express-rate-limit';
import { InMemoryUploadRepository } from './repositories/upload-repository.ts';
import { FileStoreService } from './services/file-store-service.ts';
import { registerErrorEventHandlers } from './lib/uncaught-errors.ts';

const PORT = 4000;

function setupApp() {
    const app = express();

    const rateLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 10,
    });

    app.use(rateLimiter);

    const logger = winston.createLogger({
        levels: {
            error: 0,
            info: 1,
            debug: 2,
        },
        transports: [new winston.transports.Console()],
    });

    const emailValidator = new MockEmailValidator();
    const emailValidationService = new ValidateEmailService({
        emailValidator,
    });

    const fileStoreService = new FileStoreService();

    const uploadRepository = new InMemoryUploadRepository();
    const uploadProcessor = new UploadProcessor({
        logger,
        emailValidationService,
        uploadRepository,
        fileStoreService,
    });

    const appUtility: AppUtility = {
        logger,
        uploadProcessor,
        fileStoreService,
    };

    registerErrorEventHandlers(appUtility);

    setupRoutes(app, appUtility);

    const server = app.listen(PORT, () => {
        logger.info(`Server started, listening on port: ${PORT}`);
    });

    registerShutdownEventHandlers(appUtility, server);

    return app;
}

export const app = setupApp();
