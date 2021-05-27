const fetch = require("node-fetch")

class Informer {
    constructor(streamrUrl, sessionTokenGetterFunc) {
        if (!streamrUrl) {
            throw new Error("No streamUrl given")
        }
        if (streamrUrl.endsWith("/")) {
            this.streamrUrl = streamrUrl.slice(0, streamrUrl.length - 1)
        } else {
            this.streamrUrl = streamrUrl
        }
        this.getSessionToken = sessionTokenGetterFunc
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

    logger() {
        // log nothing by default, allow override for logging
    }

    _post(apiUrl, body) {
        let logBody = ""
        if (body) {
            logBody = "\n" + JSON.stringify(body, null, 4)
        }
        this.logger("POST", apiUrl, logBody)

        return this.getSessionToken().then(sessionToken =>
            fetch(apiUrl, {
                method: "POST",
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
