
export function getEnv(key: string): string {
    const value = process.env[key]
    if (typeof value === "undefined") {
        return ""
    }
    if (value === "undefined") {
        return ""
    }
    return value
}
