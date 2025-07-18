// URL endpoints for wholesaler users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';
import { decodeTransactionResult } from '../../utils/decode';
import { ResponseErrorCodes } from '../../utils/ErrorCodes';

const router = express.Router();

router.get('/accept/:id', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.id;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('AcceptToWholesale', catchId);
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
        case ResponseErrorCodes.IS_NOT_TRANSFERRING:
            return res.status(400).json({ error: 'Batch is not transferring' });
        case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
            return res.status(403).json({ error: 'Fish batch is not transferred to you' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Fish batch is not in transferring status' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

    const responseBinary = await contract.submitTransaction('SellFishBatch', batchId);
    fabricConnection.close();

    const response = decodeTransactionResult(responseBinary);

    if (response.success) {
        return res.status(200).json(response.data);
    }

    switch (response.errorCode) {
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Organization mismatch' });
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Batch does not exist' });
        case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
            return res.status(403).json({ error: 'Fish batch is not transferred to you' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Fish batch is not in transferring status' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
    }
});

export default router;