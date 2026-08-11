import { type Logger } from 'winston';

import { type UploadProcessor } from '../lib/upload-repository.ts';
import { type IFileStoreService } from '../services/file-store-service.ts';

export type InputRecord = {
    name: string;
    email: string;
};

export type FailedInputRecord = InputRecord & {
    reason: string;
};

export interface AppUtility {
    logger: Logger;
    uploadProcessor: UploadProcessor;
    fileStoreService: IFileStoreService;
}

export type BaseStatus = {
    id: string;
};

export type PendingStatus = BaseStatus & {
    progress: `${number}%`;
};

export type ProcessedStatus = BaseStatus & {
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    details: Array<FailedInputRecord>;
};

export type Status = PendingStatus | ProcessedStatus;

export type ValidEmailResult = {
    valid: true;
    errored: false;
};

export type InvalidEmailResult = {
    valid: false;
    errored: false;
    reason: string;
};

export type ErroredEmailResult = {
    errored: true;
    reason: string;
};

export type EmailValidationResult =
    | ValidEmailResult
    | InvalidEmailResult
    | ErroredEmailResult;
