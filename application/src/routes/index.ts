import express from 'express';

import debugRoute from './debug';
import userRoute from './user';
import fishBatchRoute from './fabric/fishBatch';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
        app.use('/user', userRoute);
        app.use('/fabric/batches', fishBatchRoute);
    }
}