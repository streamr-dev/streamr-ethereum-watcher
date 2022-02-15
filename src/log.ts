
function error(...messages: any[]): void {
    console.error(...messages) // eslint-disable-line no-console
}

function warn(...messages: any[]): void {
    console.warn(...messages) // eslint-disable-line no-console
}

function info(...messages: any[]): void {
    console.info(...messages) // eslint-disable-line no-console
}

function debug(...messages: any[]): void {
    console.debug(...messages) // eslint-disable-line no-console
}

const log = {
    error,
    warn,
    info,
    debug,
}

export default log
