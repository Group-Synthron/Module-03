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
        ('vesselowner', 'localhost:7051', 'peer0.vesselowner.example.com', 'vesselowner/peer-tls-cert.pem'),
        ('processor', 'localhost:9051', 'peer0.processor.example.com', 'processor/peer-tls-cert.pem'),
        ('wholesaler', 'localhost:11051', 'peer0.wholesaler.example.com', 'wholesaler/peer-tls-cert.pem'),
        ('government', 'localhost:13051', 'peer0.government.example.com', 'government/peer-tls-cert.pem');

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

    DROP TABLE IF EXISTS enrolment;

    CREATE TABLE enrollment (
        organization TEXT PRIMARY KEY,
        ca_name TEXT NOT NULL,
        ca_client_home TEXT NOT NULL,
        ca_url TEXT NOT NULL,
        user_dir TEXT NOT NULL,
        ca_tls_path TEXT NOT NULL,
        FOREIGN KEY (organization) REFERENCES msp(organization)
    );

    INSERT INTO enrollment (organization, ca_name, ca_client_home, ca_url, user_dir, ca_tls_path) VALUES
        ('vesselowner', 'ca-vesselowner', 'vesselowner', 'localhost:7054', 'vesselowner/users', 'vesselowner/ca-tls-cert.pem'),
        ('processor', 'ca-processor', 'processor', 'localhost:8054', 'processor/users', 'processor/ca-tls-cert.pem'),
        ('wholesaler', 'ca-wholesaler', 'wholesaler', 'localhost:11054', 'wholesaler/users', 'wholesaler/ca-tls-cert.pem'),
        ('government', 'ca-government', 'government', 'localhost:13054', 'government/users', 'government/ca-tls-cert.pem');
`

export default initializationSql;