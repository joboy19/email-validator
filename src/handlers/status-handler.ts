import { type Request, type Response } from 'express';
import { Logger } from 'winston';

import { UploadProcessor } from '../lib/upload-repository.ts';

/**
 * Class for handling all middlewares for status routes.
 */
export class StatusHandler {
    private uploadProcessor: UploadProcessor;
    private logger: Logger;
    constructor({
        logger,
        uploadProcessor,
    }: {
        logger: Logger;
        uploadProcessor: UploadProcessor;
    }) {
        this.logger = logger;
        this.uploadProcessor = uploadProcessor;
    }
    allUploadStatusMiddleware() {
        return async (req: Request, res: Response) => {
            this.logger.info('Request Received to /status/all');
            const totalStatus = await this.uploadProcessor.getAllUploadStatus();

            res.send(totalStatus);
        };
    }
    uploadStatusMiddleware() {
        return async (req: Request, res: Response) => {
            this.logger.info('Request Received to /status/:upload');
            const uploadIdUnsafe = req.params.uploadId;
            if (typeof uploadIdUnsafe !== 'string') {
                return res.sendStatus(404);
            }

            const uploadData =
                await this.uploadProcessor.getUploadData(uploadIdUnsafe);

            if (!uploadData) {
                return res.sendStatus(404);
            }

            const status = await uploadData.getStatus();

            res.send(status);
        };
    }
}
