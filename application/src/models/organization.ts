import DatabaseManager from "../db/db";
import * as path from 'path';
import fs from 'fs/promises';

const credentialDir = process.env.CREDENTIAL_DIR || '../credentials';

export default class Organization {
    private name: string = '';
    private mspId: string = '';
    private peerEndpoint: string = '';
    private peerHostAlias: string = '';
    private tlsPath: string = '';

    private constructor() {}

    public static async create(name: string): Promise<Organization> {
        const dbManager = await DatabaseManager.getInstance();

        const mspId = await dbManager.getMspByOrganization(name);
        const peerEndpoint = await dbManager.getEndpointByOrganization(name);
        const peerHostAlias = await dbManager.getHostAliasByOrganization(name);
        const tlsPath = await dbManager.getTlsPathByOrganization(name);

        if (!mspId || !peerEndpoint || !peerHostAlias || !tlsPath) {
            throw new Error(`Organization ${name} not found or incomplete data`);
        }

        const organization = new Organization();

        organization.name = name;
        organization.mspId = mspId;
        organization.peerEndpoint = peerEndpoint;
        organization.peerHostAlias = peerHostAlias;
        organization.tlsPath = path.resolve(path.join(credentialDir, tlsPath));

        return organization;
    }

    public getName(): string {
        return this.name;
    }

    public getMspId(): string {
        return this.mspId;
    }

    public getPeerEndpoint(): string {
        return this.peerEndpoint;
    }

    public getPeerHostAlias(): string {
        return this.peerHostAlias;
    }

    public getTLSRootCert(): Promise<Buffer> {
        const tlsRootCert = fs.readFile(this.tlsPath);
        if (!tlsRootCert) {
            throw new Error(`TLS root certificate not found for organization: ${this.name}`);
        }
        return tlsRootCert;
    }

}