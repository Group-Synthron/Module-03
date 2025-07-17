import FabricGatewayConnection from '../../utils/conntection';
import User from '../../utils/user';

declare global {
    namespace Express {
        interface Request {
            fabricConnection?: FabricGatewayConnection;
            user?: User;
        }
    }
}