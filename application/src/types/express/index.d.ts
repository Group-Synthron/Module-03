import FabricGatewayConnection from '../utils/conntection';

declare global {
    namespace Express {
        interface Request {
            fabricConnection?: FabricGatewayConnection;
        }
    }
}