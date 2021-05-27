
function getEnv(key) {
    const value = process.env[key]
    if (value === undefined) {
        return null
    }
    return value
}

module.exports = {
    getEnv,
}