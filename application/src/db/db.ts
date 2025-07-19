import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import crypto from 'crypto';

import initializationSql from './initializationSql';
import { existsSync } from 'fs';

export default class DatabaseManager {
    private static instance: DatabaseManager | null = null;
    private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

    private constructor() {}

    public static async getInstance(): Promise<DatabaseManager> {
        if (DatabaseManager.instance) {
            return DatabaseManager.instance;
        }

        DatabaseManager.instance = new DatabaseManager();
        await DatabaseManager.initializeDatabase(DatabaseManager.instance);

        return DatabaseManager.instance;
    }

    private static async initializeDatabase(instance: DatabaseManager): Promise<void> {
        const dbFileExists = existsSync('./db.bin');

        instance.db = await open({
            filename: './db.bin',
            driver: sqlite3.Database
        });

        if (!dbFileExists) {
            await instance.db.exec(initializationSql);
        }

        console.log('Database initialized successfully');
    }

    public async getMspByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT msp FROM msp WHERE organization = ?',
            [organization]
        );

        return result ? result.msp : null;
    }

    public async getEndpointByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT endpoint FROM peers WHERE organization = ?',
            [organization]
        );

        return result ? result.endpoint : null;
    }

    public async getHostAliasByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT host_alias FROM peers WHERE organization = ?',
            [organization]
        );

        return result ? result.host_alias : null;
    }

    public async getTlsPathByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT tls_path FROM peers WHERE organization = ?',
            [organization]
        );

        return result ? result.tls_path : null;
    }

    public async getUsernameByUid(uid: number): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT username FROM users WHERE uid = ?',
            [uid]
        );

        return result ? result.username : null;
    }

    public async getOrganizationByUid(uid: number): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT organization FROM users WHERE uid = ?',
            [uid]
        );

        return result ? result.organization : null;
    }

    public async getRoleByUid(uid: number): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT role FROM users WHERE uid = ?',
            [uid]
        );

        return result ? result.role : null;
    }

    public async getMspPathByUid(uid: number): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT msp_path FROM users WHERE uid = ?',
            [uid]
        );

        return result ? result.msp_path : null;
    }

    public async getCaNameByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT ca_name FROM enrollment WHERE organization = ?',
            [organization]
        );

        return result ? result.ca_name : null;
    }

    public async getCaClientHomeByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT ca_client_home FROM enrollment WHERE organization = ?',
            [organization]
        );

        return result ? result.ca_client_home : null;
    }

    public async getCaUrlByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT ca_url FROM enrollment WHERE organization = ?',
            [organization]
        );

        return result ? result.ca_url : null;
    }

    public async getUserDirByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT user_dir FROM enrollment WHERE organization = ?',
            [organization]
        );

        return result ? result.user_dir : null;
    }

    public async getCaTlsPathByOrganization(organization: string): Promise<string | null> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT ca_tls_path FROM enrollment WHERE organization = ?',
            [organization]
        );

        return result ? result.ca_tls_path : null;
    }

    public async closeDatabase(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    public async saveUser(username: string, organization: string, msp_path: string, password: string): Promise<number> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const password_hash = crypto.createHash('md5').update(password).digest('hex');

        const result = await this.db.run(
            'INSERT INTO users (username, organization, role, msp_path, password) VALUES (?, ?, ?, ?, ?)',
            [username, organization, 'user', msp_path, password_hash]
        );

        if (result.lastID === undefined) {
            throw new Error('Failed to insert user');
        }

        return result.lastID;
    }

    public async authenticateUser(uid: number, password: string): Promise<boolean> {
        if (!this.db) {
            throw new Error('Database is probably closed');
        }

        const result = await this.db.get(
            'SELECT password FROM users WHERE uid = ?',
            [uid]
        );

        if (!result) {
            return false;
        }

        const storedHash = result.password;
        const inputHash = crypto.createHash('md5').update(password).digest('hex');

        return storedHash === inputHash;
    }
}

