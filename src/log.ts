
function dateFormatted(): string {
    const now = new Date()
    return now.toISOString()
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function error(format: string, ...messages: any[]): void {
    console.error(dateFormatted() + " " + format, ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function warn(format: string, ...messages: any[]): void {
    console.warn(dateFormatted() + " " + format, ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function info(format: string, ...messages: any[]): void {
    console.info(dateFormatted() + " " + format, ...messages) // eslint-disable-line no-console
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function debug(format: string, ...messages: any[]): void {
    console.debug(dateFormatted() + " " + format, ...messages) // eslint-disable-line no-console
}

const log = {
    error,
    warn,
    info,
    debug,
}

export default log
