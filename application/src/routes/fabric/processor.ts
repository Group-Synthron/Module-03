// URL endpoints for processor users
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

    const responseBinary = await contract.submitTransaction('AcceptToProcessing', catchId);
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
            return res.status(400).json({ error: 'Batch is not in transferring state' });
        case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
            return res.status(403).json({ error: 'Ownership verification failed' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Batch is not in transferring state' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

    const responseBinary = await contract.submitTransaction('ProcessFishBatch', catchId, `${quantity}`);
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
            return res.status(403).json({ error: 'You are not the owner of this batch' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(409).json({ error: 'Fish batch is not in the processing state' });
        case ResponseErrorCodes.INVALID_QUANTITY:
            return res.status(400).json({ error: 'Invalid quantity specified' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
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

    const responseBinary = await contract.submitTransaction('TransferToWholesale', catchId, wholesaler);
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
        case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
            return res.status(403).json({ error: 'Ownership verification failed' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(400).json({ error: 'Batch is not ready to transfer to wholesale' });
        default:
            return res.status(500).json({ error: 'Unknown error occurred' });
    }
});

export default router;