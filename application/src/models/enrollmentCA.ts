import DatabaseManager from "../db/db";
import Organization from "./organization";

export default class EnrollmentCA {
    private organization_name: string = '';
    private ca_name: string = '';
    private ca_client_home: string = '';
    private ca_url: string = '';
    private user_dir: string = '';
    private ca_tls_path: string = '';

    private constructor() {}

    public static async create(organization_name: string): Promise<EnrollmentCA> {
        const dbManager = await DatabaseManager.getInstance();

        const ca_name = await dbManager.getCaNameByOrganization(organization_name);
        const ca_client_home = await dbManager.getCaClientHomeByOrganization(organization_name);
        const ca_url = await dbManager.getCaUrlByOrganization(organization_name);
        const user_dir = await dbManager.getUserDirByOrganization(organization_name);
        const ca_tls_path = await dbManager.getCaTlsPathByOrganization(organization_name);

        if (!ca_name || !ca_client_home || !ca_url || !user_dir || !ca_tls_path) {
            throw new Error(`Enrollment CA details for organization ${organization_name} not found`);
        }

        const enrollmentCA = new EnrollmentCA();

        enrollmentCA.organization_name = organization_name;
        enrollmentCA.ca_name = ca_name;
        enrollmentCA.ca_client_home = ca_client_home;
        enrollmentCA.ca_url = ca_url;
        enrollmentCA.user_dir = user_dir;
        enrollmentCA.ca_tls_path = ca_tls_path;

        return enrollmentCA;
    }

    public getOrganizationName(): string {
        return this.organization_name;
    }

    public getCaName(): string {
        return this.ca_name;
    }

    public getCaClientHome(): string {
        return this.ca_client_home;
    }

    public getCaUrl(): string {
        return this.ca_url;
    }

    public getUserDir(): string {
        return this.user_dir;
    }

    public getCaTlsPath(): string {
        return this.ca_tls_path;
    }
}