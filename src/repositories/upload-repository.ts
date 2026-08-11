import { v4 } from 'uuid';

import {
    type InputRecord,
    type FailedInputRecord,
    type Status,
    type EmailValidationResult,
} from '../types/common.ts';

/**
 * Interface to wrap database layer with UploadData updates.
 */
export interface IUploadRepository {
    /**
     * Get upload record data from database
     * @param uploadId
     */
    getUploadRecord(uploadId: string): Promise<UploadRecord | null>;
    /**
     * Updates changeData for upload record in database
     * @param uploadId
     * @param changeData changeUploadRecord, does not need to contain whole record
     */
    setUploadRecord(
        uploadId: string,
        changeData: ChangedUploadRecord,
    ): Promise<void>;
    /**
     * Get UploadData populated with upload record
     * @param uploadId
     */
    getUploadData(uploadId: string): Promise<UploadData>;
    /**
     * Get status for all uploads in on
     * @param uploadId
     */
    getAllUploadStatus(): Promise<Record<string, Status>>;
    /**
     * Registers upload in database, ready for changes
     * @param uploadId
     */
    initializeUpload(): Promise<UploadData>;
}

export type UploadRecord = {
    id: string;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    processing: boolean;
    details: Array<FailedInputRecord>;
};

export type ChangedUploadRecord = Partial<UploadRecord>;

/**
 * Class that provides business logic for upload data. Passed a generic repository to handle
 * database layers.
 */
export class UploadData {
    id: string;
    private repository: IUploadRepository;
    constructor(
        id: string,
        {
            repository,
        }: {
            repository: IUploadRepository;
        },
    ) {
        this.id = id;
        this.repository = repository;
    }
    async setTotalCount(totalRecords: number) {
        await this.repository.setUploadRecord(this.id, { totalRecords });
    }
    async finishProcessing() {
        await this.repository.setUploadRecord(this.id, { processing: false });
    }
    /**
     * Register a single validation for a single input record.
     *
     * Handles updating total / processed / failed counts and details of failures.
     */
    async setRecordValidation(
        record: InputRecord,
        validationResult: EmailValidationResult | null,
    ) {
        const { name, email } = record;

        const currentData = await this.repository.getUploadRecord(this.id);

        if (!currentData) return;

        if (!validationResult) {
            const failedRecord = {
                name,
                email,
                reason: 'Unexpected error validating email',
            };
            currentData.failedRecords++;
            currentData.details.push(failedRecord);

            return;
        }

        if (validationResult.errored || !validationResult.valid) {
            const failedRecord = {
                name,
                email,
                reason: validationResult.reason,
            };
            currentData.failedRecords++;
            currentData.details.push(failedRecord);

            return;
        }

        currentData.processedRecords += 1;

        await this.repository.setUploadRecord(this.id, currentData);
    }
    static computeProgress(
        total: number | null,
        processed: number,
        failed: number,
    ): `${number}%` {
        if (total === null || total === 0) return '0%';
        const completed = processed + failed;
        const progress = completed / total;
        return `${Math.round(progress * 100)}%`;
    }
    /**
     * Compute status of upload. If processed, return results, otherwise compute % progress.
     */
    async getStatus(): Promise<Status> {
        const currentData = await this.repository.getUploadRecord(this.id);

        if (!currentData) throw new Error('Unable to find upload data');

        if (currentData.processing) {
            return {
                id: this.id,
                progress: UploadData.computeProgress(
                    currentData.totalRecords,
                    currentData.processedRecords,
                    currentData.failedRecords,
                ),
            };
        }

        return {
            id: this.id,
            totalRecords: currentData.totalRecords,
            processedRecords: currentData.processedRecords,
            failedRecords: currentData.failedRecords,
            details: currentData.details,
        };
    }
}

/**
 * In Memory implmentation of IUploadRepository
 */
export class InMemoryUploadRepository implements IUploadRepository {
    private knownUploads = new Map<string, UploadRecord>();
    async getUploadRecord(uploadId: string) {
        const uploadRecord = this.knownUploads.get(uploadId);
        if (!uploadRecord) return null;

        return uploadRecord;
    }
    async getUploadData(uploadId: string) {
        return this.createUploadData(uploadId);
    }
    async getAllUploadStatus() {
        const statuses: Record<string, Status> = {};
        for (const uploadId of this.knownUploads.keys()) {
            const uploadData = await this.createUploadData(uploadId);
            statuses[uploadId] = await uploadData.getStatus();
        }

        return statuses;
    }
    async setUploadRecord(uploadId: string, changedData: ChangedUploadRecord) {
        const currentData = await this.getUploadRecord(uploadId);
        if (!currentData)
            throw new Error('Setting upload record for unknown upload.');

        if ('id' in changedData && changedData.id != null)
            currentData.id = changedData.id;
        if ('totalRecords' in changedData && changedData.totalRecords != null)
            currentData.totalRecords = changedData.totalRecords;
        if (
            'processedRecords' in changedData &&
            changedData.processedRecords != null
        )
            currentData.processedRecords = changedData.processedRecords;
        if ('failedRecords' in changedData && changedData.failedRecords != null)
            currentData.failedRecords = changedData.failedRecords;
        if ('processing' in changedData && changedData.processing != null)
            currentData.processing = changedData.processing;
        if ('details' in changedData && changedData.details != null)
            currentData.details = changedData.details;

        this.knownUploads.set(uploadId, currentData);
    }
    async createUploadData(uploadId: string) {
        return new UploadData(uploadId, { repository: this });
    }
    async initializeUpload(): Promise<UploadData> {
        const uploadId = v4();

        const uploadData = await this.createUploadData(uploadId);

        this.knownUploads.set(uploadId, {
            id: uploadId,
            totalRecords: 0,
            processedRecords: 0,
            failedRecords: 0,
            processing: true,
            details: [],
        });

        return uploadData;
    }
}
