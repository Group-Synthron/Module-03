import express from 'express';

import debugRoute from './debug';
import fabricQueryRoute from './fabric/common';
import vesselOwnerRoute from './fabric/vessel-owner';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
        app.use('/fabric', fabricQueryRoute);
        app.use('/fabric/vessel-owner', vesselOwnerRoute);
    }
}