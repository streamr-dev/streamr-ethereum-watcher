const log = require("./log")
const fetch = require("node-fetch")

class CoreAPIClient {
    constructor(streamrUrl, sessionTokenGetterFunc, privateKey) {
        if (!streamrUrl) {
            throw new Error("No streamUrl given")
        }
        if (streamrUrl.endsWith("/")) {
            this.streamrUrl = streamrUrl.slice(0, streamrUrl.length - 1)
        } else {
            this.streamrUrl = streamrUrl
        }
        this.getSessionToken = sessionTokenGetterFunc
        if (!privateKey) {
            throw new Error("No privateKey given")
        }
        this.privateKey = privateKey
    }

    setDeployed(id, body) {
        const apiUrl = `${this.streamrUrl}/products/${id}/setDeployed`
        return this._post(apiUrl, body)
    }

    setUndeployed(id, body) {
        const apiUrl = `${this.streamrUrl}/products/${id}/setUndeployed`
        return this._post(apiUrl, body)
    }

    productUpdated(id, body) {
        const apiUrl = `${this.streamrUrl}/products/${id}/setPricing`
        return this._post(apiUrl, body)
    }

    subscribe(body) {
        const apiUrl = `${this.streamrUrl}/subscriptions`
        return this._post(apiUrl, body)
    }

    _post(apiUrl, body) {
        let logBody = ""
        if (body) {
            logBody = JSON.stringify(body)
        }
        log.info("Watcher/CoreAPIClient > POST", apiUrl, logBody)

        return this.getSessionToken(this.privateKey)
            .then(sessionToken => {
                return fetch(apiUrl, {
                    method: "POST",
                    body: JSON.stringify(body),
                    headers: {
                        "Accept": "application/json",
                        "Content-type": "application/json",
                        "Authorization": `Bearer ${sessionToken}`
                    }
                })
            })
    }
}

module.exports = CoreAPIClient
