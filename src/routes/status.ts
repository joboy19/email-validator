import { Router } from 'express';
import { type Logger } from 'winston';

import { UploadProcessor } from '../lib/upload-repository.ts';
import { StatusHandler } from '../handlers/status-handler.ts';

export const generateStatusRouter = ({
    logger,
    uploadProcessor,
}: {
    logger: Logger;
    uploadProcessor: UploadProcessor;
}): Router => {
    const router = Router();

    const statusHandler = new StatusHandler({
        logger,
        uploadProcessor,
    });

    router.get('/all', statusHandler.allUploadStatusMiddleware());
    router.get('/:uploadId', statusHandler.uploadStatusMiddleware());

    return router;
};
