export = {
    error(...messages: string[]): void {
        console.error(...messages) // eslint-disable-line no-console
    },
    warn(...messages: string[]): void {
        console.warn(...messages) // eslint-disable-line no-console
    },
    info(...messages: string[]): void {
        console.info(...messages) // eslint-disable-line no-console
    }
}
