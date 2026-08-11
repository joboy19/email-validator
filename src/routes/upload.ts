import { Router } from 'express';
import type { Logger } from 'winston';

import { UploadHandler } from '../handlers/upload-handler.ts';
import { type UploadProcessor } from '../lib/upload-repository.ts';
import { type IFileStoreService } from '../services/file-store-service.ts';

export const generateUploadRouter = ({
    logger,
    uploadProcessor,
    fileStoreService,
}: {
    logger: Logger;
    uploadProcessor: UploadProcessor;
    fileStoreService: IFileStoreService;
}): Router => {
    const router = Router();

    const uploadHandler = new UploadHandler({
        logger,
        uploadProcessor,
        fileStoreService,
    });

    router.post(
        '/',
        uploadHandler.initializeMiddleware(),
        uploadHandler.uploadMiddleware(),
        uploadHandler.validateFileMiddleware(),
        uploadHandler.processingMiddleware(),
        (req, res) => {
            res.send({
                uploadId: res.locals.uploadId,
                message: 'File uploaded successfully. Processing started.',
            });
        },
    );

    return router;
};
