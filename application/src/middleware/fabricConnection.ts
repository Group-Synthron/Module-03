import { Request, Response, NextFunction } from 'express';
import FabricGatewayConnection from '../utils/conntection';
import User from '../utils/user';

async function getFabricConnection(user: User) : Promise<FabricGatewayConnection | null> {
    try {
        return await FabricGatewayConnection.create(user);
    } catch (error) {
        console.error('Error creating Fabric Gateway Connection:', error);
        return null;
    }
}

export default async function fabricConnection(req: Request, res: Response, next: NextFunction) {
    console.log(`Request path: ${req.path}`);

    if (req.path.startsWith('/fabric/')) {
        if (!req.user) {
            console.warn('User not authenticated, skipping Fabric Gateway connection');
            return res.status(401).json({ error: 'NOT AUTHORIZED' });
        }

        const fabricConnection = await getFabricConnection(req.user);
        if (!fabricConnection) {
            return res.status(500).json({ error: 'Failed to connect to Fabric Gateway' });
        }

        req.fabricConnection = fabricConnection;
        console.log('Fabric Gateway Connection established');

        next();
    } else {
        next();
    }
}