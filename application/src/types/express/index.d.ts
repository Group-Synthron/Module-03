import FabricGatewayConnection from '../../utils/conntection';
import User from '../../models/user';

declare global {
    namespace Express {
        interface Request {
            fabricConnection?: FabricGatewayConnection;
            user?: User;
        }
    }
}