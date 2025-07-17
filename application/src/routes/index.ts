import express from 'express';

import debugRoute from './debug';
import fabricQueryRoute from './fabric/common';
import vesselOwnerRoute from './fabric/vessel-owner';
import processorRoute from './fabric/processor';
import wholesalerRoute from './fabric/wholesaler';
import governmentRoute from './fabric/government';
import userRoute from './user';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
        app.use('/fabric', fabricQueryRoute);
        app.use('/fabric/vessel-owner', vesselOwnerRoute);
        app.use('/fabric/processor', processorRoute);
        app.use('/fabric/wholesaler', wholesalerRoute);
        app.use('/fabric/government', governmentRoute);
        app.use('/user', userRoute);
    }
}