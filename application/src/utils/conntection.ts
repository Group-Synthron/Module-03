import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, hash, Network } from '@hyperledger/fabric-gateway';

import User from '../models/user';
import Organization from '../models/organization';

const channelName = process.env.CHANNEL_NAME;
const chaincodeName = process.env.CHAINCODE_NAME;

// Check if all required environment variables are set.
// Long line, never mind, just a variable empty check!
if (!channelName || !chaincodeName) {
    throw new Error('Missing required environment variables');
}

async function newGrpcConnection(organization: Organization): Promise<grpc.Client>{
    const tlsCredentials = grpc.credentials.createSsl(await organization.getTLSRootCert());
    return new grpc.Client(
        await organization.getPeerEndpoint(),
        tlsCredentials,
        { 'grpc.ssl_target_name_override' : await organization.getPeerHostAlias() }
    ); 
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

    public static async create(user: User): Promise<FabricGatewayConnection> {
        const instance = new FabricGatewayConnection();

        instance.client = await newGrpcConnection(user.getOrganization());
        instance.gateway = connect({
            client: instance.client,
            identity: await user.getIdentity(),
            signer: await user.getSigner(),
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