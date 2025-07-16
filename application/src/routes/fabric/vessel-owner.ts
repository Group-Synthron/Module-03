
// URL endpoints for vessel owner users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';

const router = express.Router();

router.post('/createCatch', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const location = req.body.location as string | undefined;
    const quantity = req.body.quantity as number | undefined;
    const specie = req.body.specie as string | undefined;

    if (!location || !quantity || !specie) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Missing required fields: location, quantity, specie' });
    }

    const asset = {
        ID: `catch-${Date.now()}`,
        Location: location,
        Quantity: quantity,
        Specie: specie,
    }

    await contract.submitTransaction('CreateAsset', JSON.stringify(asset));

    fabricConnection.close()
    return res.status(200).json({ id : asset.ID });
});

router.post('/transferToProcess', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.body.catchId;
    const processorId = req.body.processor;
    if (!catchId || !processorId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'id and processor values are required' });
    }

    try {
        await contract.submitTransaction('TransferToProcessing', catchId, processorId);

        fabricConnection.close()
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error transferring catch to processing:', error);
        res.status(404).json({ error: 'Could not transfer to processing' });
    }
});

export default router;