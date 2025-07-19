import FabricGatewayConnection from "../utils/conntection";
import { decodeTransactionResult } from "../utils/decode";
import { ResponseErrorCodes } from "../utils/ErrorCodes";

export async function getTransactionHistory(batchId: string, connection: FabricGatewayConnection) {
    const contract = connection.contract;

    const resultBytes = await contract.evaluateTransaction('FishSupplychain:GetFishBatchHistory', batchId);
    connection.close();

    const result = decodeTransactionResult(resultBytes);

    if (!result.success) {
        throw new Error(result.errorCode);
    }

    const history = result.data;
    if (!history.length || history.length === 0) {
        throw new Error(ResponseErrorCodes.BATCH_DOES_NOT_EXIST);
    }

    return history;
}