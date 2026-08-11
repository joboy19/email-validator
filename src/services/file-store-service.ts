import { type Readable } from 'stream';
import { createReadStream } from 'fs';
import { rm, stat, mkdir } from 'fs/promises';

export interface IFileStoreService {
    ensureFile(filename: string): Promise<boolean>;
    removeFile(filename: string): Promise<void>;
    createReadStream(filename: string): Readable;
    ensureFolder(): Promise<boolean>;
}

export class FileStoreService implements IFileStoreService {
    private getFilename(filename: string) {
        return `tmp/${filename}`;
    }
    async ensureFile(filename: string) {
        const pathToFile = this.getFilename(filename);
        const stats = await stat(pathToFile);
        return stats.isFile();
    }
    async ensureFolder() {
        try {
            const stats = await stat('tmp/');
            if (!stats.isDirectory()) return false;

            return true;
        } catch (err: unknown) {
            if (
                err &&
                typeof err === 'object' &&
                'code' in err &&
                err.code === 'ENOENT'
            ) {
                await mkdir('tmp/');
                return true;
            }

            return false;
        }
    }
    createReadStream(filename: string) {
        const pathToFile = this.getFilename(filename);
        return createReadStream(pathToFile);
    }
    removeFile(filename: string) {
        const pathToFile = this.getFilename(filename);
        return rm(pathToFile);
    }
}
