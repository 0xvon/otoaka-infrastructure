declare module '*/environment.json' {
    interface Secret {
        Name: string;
        ValueFrom: string;
    }

    interface Environment {
        Secrets: Secret[];
    }

    const env: Environment;
    export default env;
}