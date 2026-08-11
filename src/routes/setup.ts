import express from 'express';

import { generateUploadRouter } from './upload.ts';
import { generateStatusRouter } from './status.ts';
import { type AppUtility } from '../types/common.ts';

export const setupRoutes = (app: express.Express, appUtility: AppUtility) => {
    app.use('/upload', generateUploadRouter(appUtility));
    app.use('/status', generateStatusRouter(appUtility));
};
