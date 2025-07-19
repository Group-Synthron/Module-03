import express from 'express';

import debugRoute from './debug';
import userRoute from './user';
import fishBatchRoute from './fabric/fishBatch';
import vesselsRoute from './fabric/vessel';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
        app.use('/user', userRoute);
        app.use('/fabric/batches', fishBatchRoute);
        app.use('/fabric/vessels', vesselsRoute);
    }
}