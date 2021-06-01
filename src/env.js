
function getEnv(key) {
    const value = process.env[key]
    if (value === 'undefined') {
        return ""
    }
    return value
}

module.exports = {
    getEnv,
}