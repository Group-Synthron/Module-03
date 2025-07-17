import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, hash, Identity, Network, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import * as path from 'path';
import fs from 'fs/promises';

const channelName = process.env.CHANNEL_NAME;
const chaincodeName = process.env.CHAINCODE_NAME;
const mspId = process.env.MSP_ID;
const keyDirectoryPath = process.env.KEY_DIRECTORY_PATH;
const certDirectoryPath = process.env.CERT_DIRECTORY_PATH;
const tlsCertPath = process.env.TLS_CERT_PATH;
const peerEndpoint = process.env.PEER_ENDPOINT;
const peeerHostAlias = process.env.PEER_HOST_ALIAS;

// Check if all required environment variables are set.
// Long line, never mind, just a variable empty check!
if (!channelName || !chaincodeName || !mspId || !keyDirectoryPath || !certDirectoryPath || !tlsCertPath || !peerEndpoint || !peeerHostAlias) {
    throw new Error('Missing required environment variables');
}

async function newGrpcConnection(): Promise<grpc.Client>{
    const tlsRootCert = await fs.readFile(tlsCertPath!);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(
        peerEndpoint!,
        tlsCredentials,
        { 'grpc.ssl_target_name_override' : peeerHostAlias! }
    ); 
}

async function getFirstDirFileName(dirPath: string): Promise<string> {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

async function newIdentity(): Promise<Identity> {
    const certPath = await getFirstDirFileName(certDirectoryPath!);
    const credentials = await fs.readFile(certPath);

    return { mspId: mspId!, credentials };
}

async function newSigner(): Promise<Signer> {
    const keyPath = await getFirstDirFileName(keyDirectoryPath!);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    
    return signers.newPrivateKeySigner(privateKey);
}

export default class FabricGatewayConnection {
    public state: 'closed' | 'operational';
    public client: grpc.Client;
    public gateway: Gateway;
    public network: Network;
    public contract: Contract;

    private constructor() {
        this.state = 'closed';
        this.client = {} as grpc.Client;
        this.gateway = {} as Gateway;
        this.network = {} as Network;
        this.contract = {} as Contract;
    }

    public static async create(): Promise<FabricGatewayConnection> {
        const instance = new FabricGatewayConnection();

        instance.client = await newGrpcConnection();
        instance.gateway = connect({
            client: instance.client,
            identity: await newIdentity(),
            signer: await newSigner(),
            hash: hash.sha256,
            evaluateOptions: () => {
                return { deadline: Date.now() + 5000 }; // 5 seconds
            },
            endorseOptions: () => {
                return { deadline: Date.now() + 15000 }; // 15 seconds
            },
            submitOptions: () => {
                return { deadline: Date.now() + 5000 }; // 5 seconds
            },
            commitStatusOptions: () => {
                return { deadline: Date.now() + 60000 }; // 1 minute
            },
        });

        instance.network = instance.gateway.getNetwork(channelName!);
        instance.contract = instance.network.getContract(chaincodeName!);

        instance.state = 'operational';

        return instance;
    }

    public async close(): Promise<void> {
        if (this.state === 'closed') {
            return;
        }

        await this.gateway.close();
        this.client.close();
        this.state = 'closed';
    }
}