// Common URL endpoints to all users such as querying the blockchain network
import express, { Request, Response } from 'express';
import FabricGatewayConnection from '../../utils/conntection';

const router = express.Router();

router.get('/query', async (req: Request, res: Response) => {
    const fabricConnection = req.fabricConnection as FabricGatewayConnection;
    const contract = fabricConnection.contract;
    const utf8decoder = new TextDecoder('utf-8');

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');
    const resultJsonText = utf8decoder.decode(resultBytes);
    const result = JSON.parse(resultJsonText);

    fabricConnection.close()
    res.status(200).json(result);
});

export default router;