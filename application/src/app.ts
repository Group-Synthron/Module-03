import express from 'express';
import cors from 'cors';

import fabricConnection from './middleware/fabricConnection';
import Routes from './routes/index';
import authenticate from './middleware/authentication';

class App {
    public app: express.Application;
    public routes: Routes = new Routes();

    constructor() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(authenticate);
        this.app.use(fabricConnection)

        this.routes.setRoutes(this.app);
    }
}

export default new App().app;
