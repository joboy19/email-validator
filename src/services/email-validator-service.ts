import pLimit, { type LimitFunction } from 'p-limit';

import { type EmailValidationResult } from '../types/common.ts';

export interface IEmailValidator {
    validateEmail(email: unknown): Promise<EmailValidationResult>;
}

export class ValidateEmailService {
    private limit: LimitFunction;
    private emailValidator: IEmailValidator;
    constructor({ emailValidator }: { emailValidator: IEmailValidator }) {
        this.emailValidator = emailValidator;
        this.limit = pLimit(5);
    }
    async validateEmail(email: unknown): Promise<EmailValidationResult> {
        try {
            const validationResult = await this.limit(() =>
                this.emailValidator.validateEmail(email),
            );
            return validationResult;
        } catch (err: unknown) {
            let message: string = 'Unexpected Error';
            if (
                err &&
                typeof err === 'object' &&
                'message' in err &&
                typeof err.message === 'string'
            )
                message = err.message;

            return {
                errored: true,
                reason: message,
            };
        }
    }
}

export class MockEmailValidation implements IEmailValidator {
    async validateEmail(email: unknown): Promise<EmailValidationResult> {
        // artificial delay to simulate request
        await new Promise((res) => setTimeout(res, 100));

        if (Math.random() > 0.9) {
            throw new Error('Timed Out');
        }

        if (Math.random() > 0.9) {
            throw new Error('Unexpected Error');
        }

        if (typeof email !== 'string') {
            return {
                valid: false,
                errored: false,
                reason: 'Invalid email format, email is not a string',
            };
        }

        if (!email.includes('@')) {
            return {
                valid: false,
                errored: false,
                reason: 'Invalid email format, email does not contain @',
            };
        }

        return { valid: true, errored: false };
    }
}
