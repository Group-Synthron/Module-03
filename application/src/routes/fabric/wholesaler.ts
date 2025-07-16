// URL endpoints for wholesaler users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';

const router = express.Router();

router.get('/accept/:id', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.id;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    try {
        await contract.submitTransaction('AcceptToWholesale', catchId);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error accepting catch to wholesale:', error);
        return res.status(404).json({ error: 'Could not accept catch for wholesale' });
    }
});

router.get('/sell/:id', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const batchId = req.params.id;
    
    if (!batchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Batch ID is required' });
    }

    try {
        await contract.submitTransaction('SellFishBatch', batchId);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error selling fish batch:', error);
        return res.status(404).json({ error: 'Could not sell fish batch' });
    }
});

export default router;