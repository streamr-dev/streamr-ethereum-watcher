const fetch = require("node-fetch")
const urlJoin = require("url-join")

class Informer {
    constructor(streamrUrl, sessionTokenGetterFunc) {
        if (!streamrUrl) {
            throw "No streamUrl given"
        }
        this.streamrUrl = streamrUrl
        this.getSessionToken = sessionTokenGetterFunc
    }

    setDeployed(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}/setDeployed`)
        return this._post(apiUrl, body)
    }

    setUndeployed(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}/setUndeployed`)
        return this._post(apiUrl, body)
    }

    productUpdated(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}/setPricing`)
        return this._post(apiUrl, body)
    }

    subscribe(body) {
        const apiUrl = urlJoin(this.streamrUrl, "/subscriptions")
        return this._post(apiUrl, body)
    }

    logger() {
        // log nothing by default, allow override for logging
    }

    _post(apiUrl, body, method = "POST") {
        this.logger(method, apiUrl, body ? "\n" + JSON.stringify(body, null, 4) : "")

        return this.getSessionToken().then(sessionToken =>
            fetch(apiUrl, {
                method,
                body: JSON.stringify(body),
                headers: {
                    "Accept": "application/json",
                    "Content-type": "application/json",
                    "Authorization": `Bearer ${sessionToken}`
                }
            })
        )
    }
}

module.exports = Informer