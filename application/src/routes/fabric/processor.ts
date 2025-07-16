// URL endpoints for processor users
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
        await contract.submitTransaction('AcceptToProcessing', catchId);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error accepting catch to processing:', error);
        return res.status(404).json({ error: 'Could not accept catch for processing' });
    }
});

router.post('/process', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.body.catchId;
    const quantity = req.body.quantity;
    
    if (!catchId || !quantity) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and quantity are required' });
    }

    if (isNaN(quantity) || quantity <= 0) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    try {
        await contract.submitTransaction('ProcessFishBatch', catchId, `${quantity}`);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error processing fish batch:', error);
        return res.status(404).json({ error: 'Could not process fish batch' });
    }
});

router.post('/transfer', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.body.catchId;
    const wholesaler = req.body.wholesaler;
    
    if (!catchId || !wholesaler) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and wholesaler values are required' });
    }

    try {
        await contract.submitTransaction('TransferToWholesale', catchId, wholesaler);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error transferring catch to wholesale:', error);
        return res.status(404).json({ error: 'Could not transfer to wholesale' });
    }
});

export default router;