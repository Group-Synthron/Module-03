import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';
import { decodeTransactionResult } from '../../utils/decode';
import { ResponseErrorCodes } from '../../utils/ErrorCodes';
import { getTransactionHistory } from '../../services/fishBatchServices';
import evaluateAnormalies from '../../services/anormaly';

const router = express.Router();

// List all fish batches
router.get('/', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;
    const utf8decoder = new TextDecoder('utf-8');

    const resultBytes = await contract.evaluateTransaction('FishSupplychain:GetAllAssets');
    const resultJsonText = utf8decoder.decode(resultBytes);
    const result = JSON.parse(resultJsonText);

    fabricConnection.close()
    res.status(200).json(result);
});

//Get all seized fish batches; Only a government can do this.
router.get('/seized', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;
    const utf8decoder = new TextDecoder('utf-8');

    try {
        const resultBytes = await contract.evaluateTransaction('FishSupplychain:GetAllSeizedAssets');
        const resultJsonText = utf8decoder.decode(resultBytes);
        const result = JSON.parse(resultJsonText);

        fabricConnection.close();
        return res.status(200).json(result);
    } catch (error) {
        fabricConnection.close();
        console.error('Error getting seized assets:', error);
        return res.status(404).json({ error: 'Could not retrieve seized assets' });
    }
})

// Get latest state of a fish batch by catch ID
router.get('/:catchId', async (req: Request, res: Response) => {
    if (!req.params.catchId) {
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const catchId = req.params.catchId;

    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const resultBytes = await contract.evaluateTransaction('FishSupplychain:ReadAsset', catchId);
    fabricConnection.close()

    const result = decodeTransactionResult(resultBytes);

    if (result.success) {
        return res.status(200).json(result.data);
    }

    switch (result.errorCode) {
        case ResponseErrorCodes.BATCH_DOES_NOT_EXIST:
            return res.status(404).json({ error: 'Fish batch not found' });
        default:
            return res.status(500).json({ error: 'Failed to retrieve fish batch' });
    }
})

// Return history of a given fish batch
router.get('/:catchId/history', async (req: Request, res: Response) => {
    if (!req.params.catchId) {
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const catchId = req.params.catchId;
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;

    try {
        const history = await getTransactionHistory(catchId, fabricConnection);
        return res.status(200).json(history);
    } catch (error : any) {
        if (error.message === ResponseErrorCodes.BATCH_DOES_NOT_EXIST) {
            return res.status(404).json({ error: 'Fish batch history not found' });
        }

        return res.status(500).json({ error: 'Failed to retrieve fish batch history' });
    }
});

// Create a new fish batch; Only a vessel owner can do this.
router.post('/', async (req: Request, res: Response) => {
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

    const resultBinary = await contract.submitTransaction('FishSupplychain:CreateAsset', JSON.stringify(asset));
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

// Transfer a fish batch to processing; Only a vessel owner can do this.
router.post('/:catchId/transfer/processing', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    const processorId = req.body && req.body.processor;
    if (!catchId || !processorId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'id and processor values are required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:TransferToProcessing', catchId, processorId);
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
})

// Transfer a fish batch to wholesaler; Only a processor can do this.
router.post('/:catchId/transfer/wholesale', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    const wholesaler = req.body && req.body.wholesaler;
    
    if (!catchId || !wholesaler) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and wholesaler values are required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:TransferToWholesale', catchId, wholesaler);
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
})

// Accept a fish batch to processing; Only a processor can do this.
router.post('/:catchId/accept/processing', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:AcceptToProcessing', catchId);
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

// Accept a fish batch to wholesale; Only a wholesaler can do this.
router.post('/:catchId/accept/wholesale', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;

    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:AcceptToWholesale', catchId);
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
})

// Process a fish batch; Only a processor can do this.
router.patch('/:catchId/process', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    const quantity = req.body && req.body.quantity;
    
    if (!catchId || !quantity) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and quantity are required' });
    }

    if (isNaN(quantity) || quantity <= 0) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:ProcessFishBatch', catchId, `${quantity}`);
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
})

// Sell a fish batch; Only a wholesaler can do this.
router.post('/:catchId/sell', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const batchId = req.params.catchId;
    
    if (!batchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Batch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:SellFishBatch', batchId);
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

// Seize a fish batch; Only a government can do this.
router.post('/:catchId/seize', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    const reason = req.body && req.body.reason;
    
    if (!catchId || !reason) {
        fabricConnection.close();
        return res.status(400).json({ error: 'catchId and reason are required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:SeizeAsset', catchId, reason);
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
})

// Release a seized fish batch; Only a government can do this.
router.post('/:catchId/release', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;
    
    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:ReleaseSeizedAsset', catchId);
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
})

// Dispose a seized fish batch; Only a government can do this.
router.post('/:catchId/dispose', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    const catchId = req.params.catchId;

    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    const responseBinary = await contract.submitTransaction('FishSupplychain:DisposeAsset', catchId);
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
})



router.get('/:catchId/anormalies', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const catchId = req.params.catchId;

    if (!catchId) {
        fabricConnection.close();
        return res.status(400).json({ error: 'Catch ID is required' });
    }

    try {
        const anomalies = await evaluateAnormalies(catchId, fabricConnection);
        return res.status(200).json(anomalies);
    } catch (error : any) {
        if (error.message === ResponseErrorCodes.BATCH_DOES_NOT_EXIST) {
            return res.status(404).json({ error: 'Fish batch not found' });
        }

        return res.status(500).json({ error: 'Could not retrieve anomalies' });
    }
})

export default router;