/** Most functions here are copied with modifications from
 *  https://github.com/hyperledger/fabric-samples/blob/main/full-stack-asset-transfer-guide/contracts/asset-transfer-typescript/src/assetTransfer.ts
 *
 *  They are licensed under Apache License 2.0.
 */

import { X509Certificate } from 'node:crypto';
import { Context } from 'fabric-contract-api';
import { KeyEndorsementPolicy } from 'fabric-shim';
import { TextDecoder } from 'util';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';
import User from '../models/User';

const utf8Decoder = new TextDecoder();

export function unmarshal(bytes: Uint8Array | string): object {
    const json = typeof bytes === 'string' ? bytes : utf8Decoder.decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') {
        throw new Error(`Invalid JSON type (${typeof parsed}): ${json}`);
    }

    return parsed;
}

export function marshal(o: object): Buffer {
    return Buffer.from(toJsonString(o));
}

export function toJsonString(o: object): string {
    // Insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    return stringify(sortKeysRecursive(o));
}

export function clientCommonName(ctx: Context): string {
    const clientCert = new X509Certificate(ctx.clientIdentity.getIDBytes());
    const matches = clientCert.subject.match(/^CN=(.*)$/m); // [0] Matching string; [1] capture group
    if (matches?.length !== 2) {
        throw new Error(`Unable to identify client identity common name: ${clientCert.subject}`);
    }

    return matches[1];
}

export function ClientIdentifier(ctx: Context) : User {
    return new User(
        ctx.clientIdentity.getMSPID(),
        clientCommonName(ctx)
    );
}

export async function setEndorsingOrgs(ctx: Context, ledgerKey: string, ...orgs: string[]): Promise<void> {
    const policy = newMemberPolicy(...orgs);
    await ctx.stub.setStateValidationParameter(ledgerKey, policy.getPolicy());
}

function newMemberPolicy(...orgs: string[]): KeyEndorsementPolicy {
    const policy = new KeyEndorsementPolicy();
    policy.addOrgs('MEMBER', ...orgs);
    return policy;
}
