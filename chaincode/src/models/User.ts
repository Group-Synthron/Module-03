export default class User {
    public organization: string;
    public user: string;

    constructor(organization: string, user: string) {
        this.organization = organization;
        this.user = user;
    }

    public toString(): string {
        return `${this.organization}/${this.user}`;
    }

    public static fromString(value: string): User {
        const [organization, user] = value.split('/');
        return new User(organization, user);
    }
}