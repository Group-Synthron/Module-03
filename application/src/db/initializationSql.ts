const initializationSql = `
    DROP TABLE IF EXISTS msp;

    CREATE TABLE msp (
        organization TEXT PRIMARY KEY,
        msp TEXT NOT NULL
    );

    INSERT INTO msp (organization, msp) VALUES
        ('vesselowner', 'VesselOwnerMSP'),
        ('processor', 'ProcessorMSP'),
        ('wholesaler', 'WholesalerMSP'),
        ('government', 'GovernmentMSP');

    DROP TABLE IF EXISTS peers;

    CREATE TABLE peers (
        organization TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        host_alias TEXT NOT NULL,
        tls_path TEXT NOT NULL
    );

    INSERT INTO peers (organization, endpoint, host_alias, tls_path) VALUES
        ('vesselowner', 'localhost:7051', 'peer0.vesselowner.example.com', 'vesselowner/tls/ca.crt'),
        ('processor', 'localhost:9051', 'peer0.processor.example.com', 'processor/tls/ca.crt'),
        ('wholesaler', 'localhost:11051', 'peer0.wholesaler.example.com', 'wholesaler/tls/ca.crt'),
        ('government', 'localhost:13051', 'peer0.government.example.com', 'government/tls/ca.crt');

    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
        uid INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        organization TEXT NOT NULL,
        role TEXT CHECK (role IN ('admin', 'user')) NOT NULL,
        msp_path TEXT NOT NULL,
        FOREIGN KEY (organization) REFERENCES msp(organization),
        FOREIGN KEY (organization) REFERENCES peers(organization)
    );

    INSERT INTO users (username, organization, role, msp_path) VALUES
        ('vesselowneradmin', 'vesselowner', 'admin', 'vesselowner/users/Admin@vesselowner.example.com/msp'),
        ('user1', 'vesselowner', 'user', 'vesselowner/users/User1@vesselowner.example.com/msp'),
        ('processoradmin', 'processor', 'admin', 'processor/users/Admin@processor.example.com/msp'),
        ('user1', 'processor', 'user', 'processor/users/User1@processor.example.com/msp'),
        ('wholesaleradmin', 'wholesaler', 'admin', 'wholesaler/users/Admin@wholesaler.example.com/msp'),
        ('user1', 'wholesaler', 'user', 'wholesaler/users/User1@wholesaler.example.com/msp'),
        ('governmentadmin', 'government', 'admin', 'government/users/Admin@government.example.com/msp'),
        ('user1', 'government', 'user', 'government/users/User1@government.example.com/msp');
`

export default initializationSql;