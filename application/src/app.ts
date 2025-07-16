import express from 'express';
import cors from 'cors';

import Routes from './routes/index';

class App {
    public app: express.Application;
    public routes: Routes = new Routes();

    constructor() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.routes.setRoutes(this.app);
    }
}

export default new App().app;
