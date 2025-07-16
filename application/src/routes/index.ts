import debugRoute from './debug';
import express from 'express';

export default class Routes {
    public setRoutes(app: express.Application): void {
        app.use('/debug', debugRoute);
    }
}