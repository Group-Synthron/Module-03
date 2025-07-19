import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';
import { decodeTransactionResult } from '../../utils/decode';
import { ResponseErrorCodes } from '../../utils/ErrorCodes';

const router = express.Router();

// List all vessels
router.get('/', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;
    const utf8decoder = new TextDecoder('utf-8');

    const resultBytes = await contract.evaluateTransaction('VesselContract:GetAllVessels');
    const resultJsonText = utf8decoder.decode(resultBytes);
    const result = JSON.parse(resultJsonText);

    fabricConnection.close();
    res.status(200).json(result);
});

// Create a new vessel
router.post('/', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;

    if (!req.body || !req.body.ownerUserName || !req.body.licenseNumber) {
        fabricConnection.close();
        return res.status(400).json({ error: 'ownerUserName and licenseNumber are required' });
    }

    const ownerUserName = req.body.ownerUserName as string;
    const licenseNumber = req.body.licenseNumber as string;

    const vesselId = `vessel-${Date.now()}`;

    const resultBinary = await contract.submitTransaction('VesselContract:CreateVessel', vesselId, ownerUserName, licenseNumber);
    const result = decodeTransactionResult(resultBinary);
    fabricConnection.close();

    if (result.success) {
        return res.status(201).json({ id: vesselId });
    }

    switch (result.errorCode) {
        case ResponseErrorCodes.BATCH_ALREADY_EXISTS:
            return res.status(409).json({ error: 'Vessel already exists' });
        case ResponseErrorCodes.ORGANIZATION_MISMATCH:
            return res.status(403).json({ error: 'Access denied' });
        default:
            return res.status(500).json({ error: 'Failed to create vessel' });
    }
});

export default router;
