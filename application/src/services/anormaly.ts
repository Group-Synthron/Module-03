import checkMaritimeBorder from "../utils/location";
import FabricGatewayConnection from "../utils/conntection";
import { getTransactionHistory } from "./fishBatchServices";

export interface FishBatchTransaction {
    txId: string;
    timestamp: {
        seconds: number;
        nanos: number;
    };
    isDelete: boolean;
    fishBatch: {
        ID: string;
        Location: string;
        Specie: string;
        Quantity: number;
        Owner: string;
        Status: string;
    };
}

function extractTransactionSequence(txHistory: FishBatchTransaction[]) {
    return txHistory.map(tx => {
        return {
            status: tx.fishBatch.Status,
            timestamp: new Date(tx.timestamp.seconds * 1000),
        };
    });
}

function evaluateTxHistoryAnormaly(txHistory: FishBatchTransaction[]) {
    const sequence = extractTransactionSequence(txHistory);

    let seizeCount = 0;
    let previousStatus = "";

    for (const tx of sequence) {
        if (tx.status === "SEIZED") {
            seizeCount++;
        } else {
            previousStatus = tx.status;
        }
    }

    return seizeCount > 1;
}

async function evaluateLocationAnormaly(txHistory: FishBatchTransaction[]) {
    let caughtLocation = "";

    for (const tx of txHistory) {
        if (tx.fishBatch.Status === "CAUGHT") {
            caughtLocation = tx.fishBatch.Location;
            break;
        }
    }

    try {
        return !(await checkMaritimeBorder(caughtLocation));
    } catch (error) {
        return true;
    }
}

function evaluateProcessingAnormaly(txHistory: FishBatchTransaction[]) {
    const processingTx = txHistory.find(tx => tx.fishBatch.Status === "PROCESSING");
    const processedTx = txHistory.find(tx => tx.fishBatch.Status === "PROCESSED");

    if (!processedTx) {
        return false;
    }

    if (!processingTx) {
        return true; // "PROCESSED" exists but no "PROCESSING" status, anomaly
    }

    const processingWeight = processingTx.fishBatch.Quantity;
    const processedWeight = processedTx.fishBatch.Quantity;

    // Check if weight did not reduce
    if (processedWeight >= processingWeight) {
        return true;
    }

    // Check if weight loss is more than 50%
    const weightLossPercentage = ((processingWeight - processedWeight) / processingWeight) * 100;
    if (weightLossPercentage > 50) {
        return true;
    }

    return false;
}

export default async function evaluateAnormalies(batchId: string, connection: FabricGatewayConnection) {
    const txHistory = await getTransactionHistory(batchId, connection); // errors could be thrown

    return evaluateTxHistoryAnormaly(txHistory) ||
        await evaluateLocationAnormaly(txHistory) ||
        evaluateProcessingAnormaly(txHistory);
}