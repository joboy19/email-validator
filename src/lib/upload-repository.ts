import { Logger } from 'winston';
import { pipeline } from 'stream/promises';
import { type CsvParserStream, parse, type ParserRow } from 'fast-csv';

import { type EmailValidationResult } from '../types/common.ts';
import {
    type IUploadRepository,
    type UploadData,
} from '../repositories/upload-repository.ts';
import { ValidateEmailService } from '../services/email-validator-service.ts';
import { type IFileStoreService } from '../services/file-store-service.ts';

type PerRecordGenerator = (
    stream: CsvParserStream<ParserRow, ParserRow>,
) => AsyncGenerator<void, void, unknown>;

export class CsvStreamHandler {
    private perRecordGenerator: PerRecordGenerator;
    fileName: string;
    fileStoreService: IFileStoreService;
    constructor({
        fileName,
        perRecordGenerator,
        fileStoreService,
    }: {
        fileName: string;
        perRecordGenerator: PerRecordGenerator;
        fileStoreService: IFileStoreService;
    }) {
        this.fileName = fileName;
        this.perRecordGenerator = perRecordGenerator;
        this.fileStoreService = fileStoreService;
    }
    async process() {
        const isFile = await this.fileStoreService.ensureFile(this.fileName);
        if (!isFile) return;

        await pipeline(
            this.fileStoreService.createReadStream(this.fileName),
            parse({ headers: true }),
            this.perRecordGenerator,
        );
    }
}

export class UploadProcessor {
    private logger: Logger;
    private emailValidationService: ValidateEmailService;
    private uploadRepository: IUploadRepository;
    private fileStoreService: IFileStoreService;
    constructor({
        logger,
        emailValidationService,
        uploadRepository,
        fileStoreService,
    }: {
        logger: Logger;
        emailValidationService: ValidateEmailService;
        uploadRepository: IUploadRepository;
        fileStoreService: IFileStoreService;
    }) {
        this.logger = logger;
        this.emailValidationService = emailValidationService;
        this.uploadRepository = uploadRepository;
        this.fileStoreService = fileStoreService;
    }

    async initializeUpload() {
        const uploadData = await this.uploadRepository.initializeUpload();

        this.logger.info(`Upload Initialized, upload id: ${uploadData.id}`);
        return uploadData.id;
    }
    async getUploadData(uploadId: string) {
        return await this.uploadRepository.getUploadData(uploadId);
    }
    async getAllUploadStatus() {
        return await this.uploadRepository.getAllUploadStatus();
    }
    beginProcessingUpload(uploadId: string): void {
        this.processUpload(uploadId);
    }
    async processUpload(uploadId: string) {
        const uploadData = await this.uploadRepository.getUploadData(uploadId);
        if (!uploadData) return;

        try {
            await this.totalCountStreamInner(uploadData);
            await this.validationStreamInner(uploadData);

            await uploadData.finishProcessing();
        } catch (err: unknown) {
            this.logger.error(
                `Error processing upload: ${uploadId}. Aborting`,
                err,
            );
        } finally {
            await this.removeTempFile(uploadData);
        }
    }
    private getFilename(uploadData: UploadData) {
        return `${uploadData.id}.csv`;
    }
    private async totalCountStreamInner(uploadData: UploadData) {
        try {
            let totalRecordCount = 0;

            const totalCountCsvStreamHandler = new CsvStreamHandler({
                fileName: this.getFilename(uploadData),
                fileStoreService: this.fileStoreService,
                perRecordGenerator: async function* (
                    stream: CsvParserStream<ParserRow, ParserRow>,
                ) {
                    for await (const record of stream) {
                        const validRecord =
                            UploadProcessor.validateRecord(record);
                        if (validRecord) totalRecordCount++;
                        yield;
                    }
                },
            });

            await totalCountCsvStreamHandler.process();

            uploadData.setTotalCount(totalRecordCount);

            this.logger.info(`Finished counting upload ${uploadData.id}`);
        } catch (err: unknown) {
            this.logger.error(
                'Error processing Upload ${uploadId}. Aborting whole processing.',
            );
        }
    }
    private async validationStreamInner(uploadData: UploadData) {
        try {
            const validationCsvStreamHandler = new CsvStreamHandler({
                fileName: this.getFilename(uploadData),
                fileStoreService: this.fileStoreService,
                perRecordGenerator: (
                    stream: CsvParserStream<ParserRow, ParserRow>,
                ) => this.validateRecordStream(uploadData, stream),
            });

            await validationCsvStreamHandler.process();

            this.logger.info(`Finished validating upload ${uploadData.id}`);
        } catch (err: unknown) {
            this.logger.error(
                'Error processing Upload ${uploadId}. Aborting whole processing.',
            );
        }
    }
    private async removeTempFile(uploadData: UploadData) {
        try {
            await this.fileStoreService.removeFile(
                this.getFilename(uploadData),
            );
        } catch (err: unknown) {
            this.logger.error(
                `Error deleting file for upload: ${uploadData.id}.`,
                err,
            );
        }
    }
    private async validateRecordEmail(uploadData: UploadData, record: unknown) {
        const validRecord = UploadProcessor.validateRecord(record);
        if (!validRecord) return;

        this.logger.debug(
            `Processing row. Name: ${record.name} Email: ${record.email}`,
        );

        let validationResult: EmailValidationResult | null = null;

        try {
            validationResult = await this.emailValidationService.validateEmail(
                record.email,
            );
        } finally {
            await uploadData.setRecordValidation(
                { name: record.name, email: record.email },
                validationResult,
            );
        }
    }
    private async *validateRecordStream(
        uploadData: UploadData,
        stream: CsvParserStream<ParserRow, ParserRow>,
    ) {
        for await (const record of stream) {
            yield this.validateRecordEmail(uploadData, record);
        }
    }
    static validateRecord(
        record: unknown,
    ): record is { name: string; email: string } {
        if (typeof record !== 'object' || record === null) return false;
        if (!('name' in record) || !('email' in record)) return false;

        if (typeof record.name !== 'string' || typeof record.email !== 'string')
            return false;

        return true;
    }
}
