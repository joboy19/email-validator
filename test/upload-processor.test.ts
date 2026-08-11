import 'mocha';
import { expect } from 'chai';
import { Readable } from 'stream';
import winston from 'winston';

import {
    ValidateEmailService,
    type IEmailValidator,
} from '../src/services/email-validator-service.ts';

import { type IFileStoreService } from '../src/services/file-store-service.ts';
import { UploadProcessor } from '../src/lib/upload-repository.ts';

import { InMemoryUploadRepository } from '../src/repositories/upload-repository.ts';
import {
    type Status,
    type EmailValidationResult,
} from '../src/types/common.ts';

describe('upload processor tests', function () {
    describe('csv parsing full processing', function () {
        const testCases: Array<{
            name: string;
            provided: {
                validateEmail: (
                    email: unknown,
                ) => Promise<EmailValidationResult>;
                createReadStream: (filename: string) => Readable;
                wait: boolean;
            };
            expected: {
                status: Omit<Status, 'id'>;
            };
        }> = [
            {
                name: 'normal single file',
                provided: {
                    validateEmail: async () => {
                        return { valid: true, errored: false };
                    },
                    createReadStream: (filename: string) => {
                        const buffer = Buffer.from(
                            'name,email\nJohn Doe,john@example.com\nJohn Doe,john@example.com\n',
                        );
                        const stream = Readable.from(buffer);

                        return stream;
                    },
                    wait: true,
                },
                expected: {
                    status: {
                        details: [],
                        processedRecords: 2,
                        totalRecords: 2,
                        failedRecords: 0,
                    },
                },
            },
            {
                name: 'handle an invalid email',
                provided: {
                    validateEmail: async () => {
                        return {
                            valid: false,
                            errored: false,
                            reason: 'Test',
                        };
                    },
                    createReadStream: (filename: string) => {
                        const buffer = Buffer.from(
                            'name,email\nJohn Doe,john@example.com\n',
                        );
                        const stream = Readable.from(buffer);

                        return stream;
                    },
                    wait: true,
                },
                expected: {
                    status: {
                        details: [
                            {
                                name: 'John Doe',
                                email: 'john@example.com',
                                reason: 'Test',
                            },
                        ],
                        processedRecords: 0,
                        totalRecords: 1,
                        failedRecords: 1,
                    },
                },
            },
            {
                name: 'one invalid one non-invalid',
                provided: {
                    validateEmail: async (email: unknown) => {
                        if (email === 'invalid') {
                            return {
                                valid: false,
                                errored: false,
                                reason: 'Test',
                            };
                        }

                        return {
                            valid: true,
                            errored: false,
                        };
                    },
                    createReadStream: (filename: string) => {
                        const buffer = Buffer.from(
                            'name,email\nJohn Doe,john@example.com\nJohn Invalid,invalid\n',
                        );
                        const stream = Readable.from(buffer);

                        return stream;
                    },
                    wait: true,
                },
                expected: {
                    status: {
                        details: [
                            {
                                name: 'John Invalid',
                                email: 'invalid',
                                reason: 'Test',
                            },
                        ],
                        processedRecords: 1,
                        totalRecords: 2,
                        failedRecords: 1,
                    },
                },
            },
            {
                name: 'should not crash the service if the email service errors',
                provided: {
                    validateEmail: async () => {
                        throw new Error('oops');
                    },
                    createReadStream: (filename: string) => {
                        const buffer = Buffer.from(
                            'name,email\nJohn Doe,john@example.com\n',
                        );
                        const stream = Readable.from(buffer);

                        return stream;
                    },
                    wait: true,
                },
                expected: {
                    status: {
                        details: [
                            {
                                name: 'John Doe',
                                email: 'john@example.com',
                                reason: 'oops',
                            },
                        ],
                        processedRecords: 0,
                        totalRecords: 1,
                        failedRecords: 1,
                    },
                },
            },
        ];
        for (const testCase of testCases) {
            describe(testCase.name, function () {
                let status: Status;
                let fileRemoved: boolean = false;
                before(async function () {
                    const emailValidationService: IEmailValidator = {
                        validateEmail: testCase.provided.validateEmail,
                    };

                    const validateEmailService = new ValidateEmailService({
                        emailValidator: emailValidationService,
                    });

                    const fileStore: IFileStoreService = {
                        ensureFile: async () => true,
                        createReadStream: testCase.provided.createReadStream,
                        removeFile: async () => {
                            fileRemoved = true;
                        },
                        ensureFolder: async () => true,
                    };

                    const logger = winston.createLogger({
                        levels: {
                            error: 0,
                            info: 1,
                            debug: 2,
                        },
                        transports: [
                            new winston.transports.Console({ silent: true }),
                        ],
                    });

                    const uploadRepository = new InMemoryUploadRepository();
                    const uploadData =
                        await uploadRepository.initializeUpload();

                    const uploadProcessor = new UploadProcessor({
                        logger,
                        uploadRepository,
                        emailValidationService: validateEmailService,
                        fileStoreService: fileStore,
                    });

                    if (testCase.provided.wait) {
                        await uploadProcessor.processUpload(uploadData.id);
                    } else {
                        uploadProcessor.processUpload(uploadData.id);
                    }

                    status = await uploadData.getStatus();
                });

                it('should call file removal', function () {
                    expect(fileRemoved).to.be.true;
                });
                it('should return the correct status', function () {
                    expect(status.id).to.exist;
                    expect(status).to.deep.include(testCase.expected.status);
                });
            });
        }
    });
});
