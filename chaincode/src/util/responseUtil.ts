export interface ResponseObject {
    success: boolean;
    data?: any;
    errorCode?: string;
}

export function responseSuccess(data: any) : ResponseObject {
    return {
        success: true,
        data
    };
}

export function responseError(errorCode: string) : ResponseObject {
    return {
        success: false,
        errorCode,
    };
}

export enum ResponseErrorCodes {
    ORGANIZATION_MISMATCH = 'ORGANIZATION_MISMATCH',
    OWNERSHIP_VERIFICATION_FAILED = 'OWNERSHIP_VERIFICATION_FAILED',
    BATCH_ALREADY_EXISTS = 'BATCH_ALREADY_EXISTS',
    STATUS_MISMATCH = 'STATUS_MISMATCH',
    INVALID_QUANTITY = 'INVALID_QUANTITY',
    BATCH_DOES_NOT_EXIST = 'BATCH_DOES_NOT_EXIST',
    IS_NOT_TRANSFERRING = 'IS_NOT_TRANSFERRING',
}