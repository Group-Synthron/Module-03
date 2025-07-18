// URL endpoints for vessel owner users
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';
import { decodeTransactionResult } from '../../utils/decode';
import { ResponseErrorCodes } from '../../utils/ErrorCodes';

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

    const resultBinary = await contract.submitTransaction('CreateAsset', JSON.stringify(asset));
    const result = decodeTransactionResult(resultBinary);
    fabricConnection.close();

    if (result.success) {
        return res.status(200).json({ id : asset.ID });
    }

    switch (result.errorCode) {
        case ResponseErrorCodes.BATCH_ALREADY_EXISTS:
            return res.status(409).json({ error: 'Batch already exists' });
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Only Vessel Owners can create fish batches' });
        default:
            return res.status(500).json({ error: 'Failed to create catch' });
    }
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

    const responseBinary = await contract.submitTransaction('TransferToProcessing', catchId, processorId);
    fabricConnection.close();

    const response = decodeTransactionResult(responseBinary);

    if (response.success) {
        return res.status(204).send();
    }

    switch (response.errorCode) {
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Only Vessel Owners can transfer fish batches' });
        case ResponseErrorCodes.OWNERSHIP_VERIFICATION_FAILED:
            return res.status(403).json({ error: 'Only owner can transfer fish batches' });
        case ResponseErrorCodes.STATUS_MISMATCH:
            return res.status(409).json({ error: 'Batch is not in a transferable state' });
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Batch does not exist' });
        default:
            return res.status(500).json({ error: 'Failed to transfer catch to processing' });
    }
});

export default router;