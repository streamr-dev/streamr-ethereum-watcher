
export function getEnv(key: string): string {
    const value: string | undefined = process.env[key]
    if (typeof value === "undefined") {
        return ""
    } else {
        if (value === "undefined") {
            return ""
        }
        return value
    }
}
