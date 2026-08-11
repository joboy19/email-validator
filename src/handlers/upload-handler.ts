import { type NextFunction, type Request, type Response } from 'express';
import { Logger } from 'winston';
import multer from 'multer';

import { type UploadProcessor } from '../lib/upload-repository.ts';
import { type IFileStoreService } from '../services/file-store-service.ts';

const VALID_MIME_TYPES = ['text/csv'];
const FILE_INVALID = Object.freeze({
    NO_FILE: 'no-file',
    MIME_TYPE: 'mimetype',
});

/**
 * Class for handling all middlewares for upload routes.
 */
export class UploadHandler {
    private uploadProcessor: UploadProcessor;
    private logger: Logger;
    private fileStoreService: IFileStoreService;
    constructor({
        logger,
        uploadProcessor,
        fileStoreService,
    }: {
        logger: Logger;
        uploadProcessor: UploadProcessor;
        fileStoreService: IFileStoreService;
    }) {
        this.logger = logger;
        this.uploadProcessor = uploadProcessor;
        this.fileStoreService = fileStoreService;
    }
    initializeMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            this.logger.info('Request Received to /upload');

            try {
                const uploadId = await this.uploadProcessor.initializeUpload();
                res.locals.uploadId = uploadId;

                next();
            } catch (err: unknown) {
                this.logger.error('Error initializing upload.', err);
                next(err);
            }
        };
    }
    uploadMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const folderExists = await this.fileStoreService.ensureFolder();

            if (!folderExists) {
                return res.status(500).send('Internal Server Error');
            }

            const uploadId = res.locals.uploadId;
            const diskStorage = multer.diskStorage({
                destination(req, file, callback) {
                    callback(null, 'tmp');
                },
                filename(req, file, callback) {
                    callback(null, `${uploadId}.csv`);
                },
            });
            const upload = multer({
                storage: diskStorage,
                limits: {
                    fileSize: 1_000_000_000, // 10 GB
                },
                fileFilter(req, file, callback) {
                    if (!file) {
                        if (req.res)
                            req.res.locals.fileInvalidError =
                                FILE_INVALID.NO_FILE;
                        return callback(null, false);
                    }
                    if (!VALID_MIME_TYPES.includes(file.mimetype)) {
                        if (req.res)
                            req.res.locals.fileInvalidError =
                                FILE_INVALID.MIME_TYPE;
                        return callback(null, false);
                    }

                    return callback(null, true);
                },
            });

            upload.single('csv')(req, res, next);
        };
    }
    validateFileMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            // all request file validation should take place in fileFilter to prevent upload of invalid file
            if (req.file) return next();

            const fileInvalidError = res.locals.fileInvalidError;
            const missingFile = !fileInvalidError;

            if (missingFile) {
                return res.send('Missing File').status(400);
            }

            switch (fileInvalidError) {
                case FILE_INVALID.MIME_TYPE: {
                    return res.status(415).send('Incorrect file type');
                }
                case FILE_INVALID.NO_FILE: {
                    return res.status(400).send('Missing File');
                }
                default: {
                    return res.status(400).send('Invalid File');
                }
            }
        };
    }
    processingMiddleware() {
        return async (req: Request, res: Response, next: NextFunction) => {
            const uploadId = res.locals.uploadId;
            this.uploadProcessor.beginProcessingUpload(uploadId);
            next();
        };
    }
}
