import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { spawnSync } from 'child_process';
import EnrollmentCA from '../models/enrollmentCA';

if (!process.env.FABRIC_CA_CLIENT_BINARY) {
    throw new Error('FABRIC_CA_CLIENT_BINARY environment variable is not set');
}

const ca_bin_path = path.resolve(process.env.FABRIC_CA_CLIENT_BINARY);

export default async function enrollUser(organizationName: string, userName: string) {
    const enrollmentCA = await EnrollmentCA.create(organizationName);
    const password = getRandomText(16);
    const credentialDir = process.env.CREDENTIAL_DIR || '../credentials';
    const tls_path = path.resolve(path.join(credentialDir, enrollmentCA.getCaTlsPath()));
    const userDirName = generateMD5(`${userName}.${password}`);
    const userDir = path.resolve(path.join(credentialDir, enrollmentCA.getUserDir(), userDirName));

    const register_args = [
        'register',
        '--caname', enrollmentCA.getCaName(),
        '--id.name', userName,
        '--id.secret', password,
        '--id.type', 'client',
        '--tls.certfiles', tls_path,
        '--url', `https://${enrollmentCA.getCaUrl()}`,
    ];

    const enroll_args = [
        'enroll',
        '-u', `https://${userName}:${password}@${enrollmentCA.getCaUrl()}`,
        '--caname', enrollmentCA.getCaName(),
        '-M', userDir,
        '--tls.certfiles', tls_path,
    ];

    const ca_client_home = path.resolve(path.join(credentialDir, enrollmentCA.getCaClientHome()));
    console.info(`Client home directory: ${ca_client_home}`);
    const env = { FABRIC_CA_CLIENT_HOME: ca_client_home };

    const register_process = spawnSync(ca_bin_path, register_args, { env });
    if (!register_process.stdout.toString().includes('Password')) {
        throw new Error(`Registration failed: ${register_process.stderr.toString()}`);
    }

    const enroll_process = spawnSync(ca_bin_path, enroll_args, { env });
    const enrollErrorOutput = enroll_process.stderr.toString();

    let enrollmentStatus = false;
    if (enrollErrorOutput.includes('Stored Issuer public key')) {
        enrollmentStatus = true;
    }

    const configFilePath = path.join(ca_client_home, 'fabric-ca-client-config.yaml');
    try {
        await fs.unlink(configFilePath);
    } catch (error) {
        console.error(`Failed to delete file: ${configFilePath}`, error);
    }

    if (!enrollmentStatus) {
        return '';
    }

    return path.join(enrollmentCA.getUserDir(), userDirName);
}

function getRandomText(length: number): string {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function generateMD5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
}