// URL endpoints for government users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';
import { decodeTransactionResult } from '../../utils/decode';
import { ResponseErrorCodes } from '../../utils/ErrorCodes';

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

    const responseBinary = await contract.submitTransaction('SeizeAsset', catchId, reason);
    fabricConnection.close();

    const response = decodeTransactionResult(responseBinary);

    if (response.success) {
        return res.status(204).send();
    }

    switch (response.errorCode) {
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Organization mismatch' });
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Batch does not exist' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

    const responseBinary = await contract.submitTransaction('ReleaseSeizedAsset', catchId);
    fabricConnection.close();

    const response = decodeTransactionResult(responseBinary);

    if (response.success) {
        return res.status(204).send();
    }

    switch (response.errorCode) {
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Organization mismatch' });
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Batch does not exist' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Batch is not in seized status' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

    const responseBinary = await contract.submitTransaction('DisposeAsset', catchId);
    fabricConnection.close();

    const response = decodeTransactionResult(responseBinary);

    if (response.success) {
        return res.status(204).send();
    }

    switch (response.errorCode) {
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Organization mismatch' });
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Batch does not exist' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Batch is not in seized status' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

router.get('/history/:id', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.id;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    try {
        const resultBytes = await contract.evaluateTransaction('GetFishBatchHistory', catchId);
        const result = decodeTransactionResult(resultBytes);

        fabricConnection.close();
        return res.status(200).json(result);
    } catch (error) {
        fabricConnection.close();
        console.error('Error getting asset history:', error);
        return res.status(404).json({ error: 'Could not retrieve asset history' });
    }
})

export default router;