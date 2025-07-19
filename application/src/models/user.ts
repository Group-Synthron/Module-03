import { Identity, Signer, signers } from "@hyperledger/fabric-gateway";
import * as crypto from 'crypto';
import * as path from 'path';
import fs from 'fs/promises';

import DatabaseManager from "../db/db";
import Organization from "./organization";

async function getFirstDirFileName(dirPath: string): Promise<string> {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }

    return path.resolve(path.join(dirPath, file));
}

const credentialDir = process.env.CREDENTIAL_DIR || '../credentials';

export default class User {
    private uid: number = -1;
    private username: string = '';
    private organization: Organization = {} as Organization;
    private role: string = '';
    private mspPath: string = '';
    private msp: string = '';

    private constructor() {}

    public static async create(uid: number): Promise<User> {
        const dbManager = await DatabaseManager.getInstance();

        const username = await dbManager.getUsernameByUid(uid);
        const organizationName = await dbManager.getOrganizationByUid(uid);
        const role = await dbManager.getRoleByUid(uid);
        const mspPath = await dbManager.getMspPathByUid(uid);

        if (!username || !organizationName || !role || !mspPath) {
            throw new Error(`User with UID ${uid} not found`);
        }

        const organization = await Organization.create(organizationName);

        const user = new User();
        user.uid = uid;
        user.username = username;
        user.organization = organization;
        user.role = role;
        user.mspPath = path.join(credentialDir, mspPath);
        user.msp = organization.getMspId();

        return user;
    }

    public getUid(): number {
        return this.uid;
    }

    public getUsername(): string {
        return this.username;
    }

    public getOrganization(): Organization {
        return this.organization;
    }

    public getRole(): string {
        return this.role;
    }

    public async getIdentity(): Promise<Identity> {
        const certDirPath = path.join(this.mspPath, 'signcerts');
        const certPath = await getFirstDirFileName(certDirPath);
        const credentials = await fs.readFile(certPath);

        return { mspId: this.msp, credentials };
    }

    public async getSigner(): Promise<Signer> {
        const keyDirPath = path.join(this.mspPath, 'keystore');
        const keyPath = await getFirstDirFileName(keyDirPath);
        const privateKeyPem = await fs.readFile(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);

        return signers.newPrivateKeySigner(privateKey);
    }

    public async checkAuthentication(password: string): Promise<boolean> {
        const dbManager = await DatabaseManager.getInstance();
        return dbManager.authenticateUser(this.uid, password);
    }
}