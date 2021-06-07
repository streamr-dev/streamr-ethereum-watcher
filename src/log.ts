
function error(...messages: string[]): void {
    console.error(...messages) // eslint-disable-line no-console
}

function warn(...messages: string[]): void {
    console.warn(...messages) // eslint-disable-line no-console
}

function info(...messages: string[]): void {
    console.info(...messages) // eslint-disable-line no-console
}

function debug(...messages: string[]): void {
    console.debug(...messages) // eslint-disable-line no-console
}

const log = {
    error,
    warn,
    info,
    debug,
}

export default log
