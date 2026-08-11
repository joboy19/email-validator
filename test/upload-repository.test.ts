import 'mocha';
import { expect } from 'chai';

import { type Status } from '../src/types/common.ts';

import { InMemoryUploadRepository } from '../src/repositories/upload-repository.ts';
import { type EmailValidationResult } from '../src/types/common.ts';

describe('Upload Data Tests', function () {
    const testCases: Array<{
        name: string;
        provided: {
            totalRecords: number;
            recordValidations: Array<{
                record: { name: string; email: string };
                validationResult: EmailValidationResult | null;
            }>;
        };
        expected: {
            status: Omit<Status, 'id'>;
        };
    }> = [
        {
            name: 'empty validations',
            provided: {
                totalRecords: 0,
                recordValidations: [],
            },
            expected: {
                status: {
                    processedRecords: 0,
                    failedRecords: 0,
                    totalRecords: 0,
                    details: [],
                },
            },
        },
        {
            name: 'single valid email',
            provided: {
                totalRecords: 1,
                recordValidations: [
                    {
                        record: { name: 'John', email: 'Email' },
                        validationResult: { valid: true, errored: false },
                    },
                ],
            },
            expected: {
                status: {
                    processedRecords: 1,
                    failedRecords: 0,
                    totalRecords: 1,
                    details: [],
                },
            },
        },
        {
            name: 'single invalid email - timed out',
            provided: {
                totalRecords: 1,
                recordValidations: [
                    {
                        record: { name: 'John', email: 'Email' },
                        validationResult: {
                            errored: true,
                            reason: 'Timed Out',
                        },
                    },
                ],
            },
            expected: {
                status: {
                    processedRecords: 0,
                    failedRecords: 1,
                    totalRecords: 1,
                    details: [
                        {
                            name: 'John',
                            email: 'Email',
                            reason: 'Timed Out',
                        },
                    ],
                },
            },
        },
        {
            name: 'single empty validation - unexpected error',
            provided: {
                totalRecords: 1,
                recordValidations: [
                    {
                        record: { name: 'John', email: 'Email' },
                        validationResult: null,
                    },
                ],
            },
            expected: {
                status: {
                    processedRecords: 0,
                    failedRecords: 1,
                    totalRecords: 1,
                    details: [
                        {
                            name: 'John',
                            email: 'Email',
                            reason: 'Unexpected error validating email',
                        },
                    ],
                },
            },
        },
        {
            name: 'two valid empty validation - unexpected error',
            provided: {
                totalRecords: 1,
                recordValidations: [
                    {
                        record: { name: 'John', email: 'Email' },
                        validationResult: null,
                    },
                ],
            },
            expected: {
                status: {
                    processedRecords: 0,
                    failedRecords: 1,
                    totalRecords: 1,
                    details: [
                        {
                            name: 'John',
                            email: 'Email',
                            reason: 'Unexpected error validating email',
                        },
                    ],
                },
            },
        },
        {
            name: 'two total, one success',
            provided: {
                totalRecords: 2,
                recordValidations: [
                    {
                        record: { name: 'John', email: 'Email' },
                        validationResult: { valid: true, errored: false },
                    },
                ],
            },
            expected: {
                status: {
                    progress: '50%',
                },
            },
        },
    ];

    for (const testCase of testCases) {
        describe(testCase.name, function () {
            let status: Status;

            before(async function () {
                const mockUploadRepository = new InMemoryUploadRepository();
                const uploadData =
                    await mockUploadRepository.initializeUpload();

                await uploadData.setTotalCount(testCase.provided.totalRecords);
                const recordValidations = testCase.provided.recordValidations;
                for (const recordValidation of recordValidations) {
                    const { record, validationResult } = recordValidation;
                    await uploadData.setRecordValidation(
                        record,
                        validationResult,
                    );
                }

                if (
                    recordValidations.length === testCase.provided.totalRecords
                ) {
                    await uploadData.finishProcessing();
                }

                status = await uploadData.getStatus();
            });

            it('should return the correct status', function () {
                expect(status.id).to.exist;
                expect(status).to.deep.include(testCase.expected.status);
            });
        });
    }
});
