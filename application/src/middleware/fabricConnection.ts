import { Request, Response, NextFunction } from 'express';
import FabricGatewayConnection from '../utils/conntection';

async function getFabricConnection() : Promise<FabricGatewayConnection | null> {
    try {
        return await FabricGatewayConnection.create(2);
    } catch (error) {
        console.error('Error creating Fabric Gateway Connection:', error);
        return null;
    }
}

export default async function fabricConnection(req: Request, res: Response, next: NextFunction) {
    console.log(`Request path: ${req.path}`);

    if (req.path.startsWith('/fabric/')) {
        const fabricConnection = await getFabricConnection();
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