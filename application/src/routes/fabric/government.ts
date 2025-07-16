// URL endpoints for government users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';

const router = express.Router();

router.post('/seized', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.body.catchId;
    const reason = req.body.reason;
    
    if (!catchId || !reason) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and reason are required' });
    }

    try {
        await contract.submitTransaction('SeizeAsset', catchId, reason);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error seizing asset:', error);
        return res.status(404).json({ error: 'Could not seize asset' });
    }
});

router.patch('/seized/:id/release', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.id;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    try {
        await contract.submitTransaction('ReleaseSeizedAsset', catchId);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error releasing seized asset:', error);
        return res.status(404).json({ error: 'Could not release seized asset' });
    }
});

router.delete('/seized/:id', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.id;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    try {
        await contract.submitTransaction('DisposeAsset', catchId);

        fabricConnection.close();
        return res.status(200).send();
    } catch (error) {
        fabricConnection.close();
        console.error('Error disposing asset:', error);
        return res.status(404).json({ error: 'Could not dispose asset' });
    }
});

router.get('/seized', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;
    const utf8decoder = new TextDecoder('utf-8');

    try {
        const resultBytes = await contract.evaluateTransaction('GetAllSeizedAssets');
        const resultJsonText = utf8decoder.decode(resultBytes);
        const result = JSON.parse(resultJsonText);

        fabricConnection.close();
        return res.status(200).json(result);
    } catch (error) {
        fabricConnection.close();
        console.error('Error getting seized assets:', error);
        return res.status(404).json({ error: 'Could not retrieve seized assets' });
    }
});

export default router;