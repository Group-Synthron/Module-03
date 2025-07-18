const decoder = new TextDecoder('utf-8');

export interface ResponseObject {
    success: boolean;
    data?: any;
    errorCode?: string;
}

export function decodeTransactionResult(result: Uint8Array): ResponseObject {
    return JSON.parse(decoder.decode(result)) as ResponseObject;
}