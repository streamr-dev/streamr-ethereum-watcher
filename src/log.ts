
function dateFormatted(): string {
    const now = new Date()
    return now.toISOString()
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function error(...messages: any[]): void {
    console.error(dateFormatted(), ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function warn(...messages: any[]): void {
    console.warn(dateFormatted(), ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function info(...messages: any[]): void {
    console.info(dateFormatted(), ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function debug(...messages: any[]): void {
    console.debug(dateFormatted(), ...messages) // eslint-disable-line no-console
}

const log = {
    error,
    warn,
    info,
    debug,
}

export default log
