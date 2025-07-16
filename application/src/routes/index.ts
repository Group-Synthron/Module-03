import express from 'express';

import debugRoute from './debug';
import fabricQueryRoute from './fabric/common';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
        app.use('/fabric', fabricQueryRoute);
    }
}