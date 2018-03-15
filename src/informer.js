const fetch = require('node-fetch')
const urlJoin = require('url-join')

class Informer {
    constructor(streamrUrl, devOpsAccessToken) {
        if (!streamrUrl) {
            throw 'No streamUrl given'
        }
        if (!devOpsAccessToken) {
            throw 'No devOpsAccessToken given'
        }
        this.streamrUrl = streamrUrl
        this.devOpsAccessToken = devOpsAccessToken
        this.logging = false
    }

    setDeployed(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}/setDeployed`)
        return this._post(apiUrl, body)
    }

    setUndeployed(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}/setUndeployed`)
        return this._post(apiUrl, body)
    }

    subscribe(body) {
        const apiUrl = urlJoin(this.streamrUrl, `/subscriptions`)
        return this._post(apiUrl, body)
    }

    _post(apiUrl, body) {
        if (this.logging) {
            console.info("POST", apiUrl, body ? '\n' + JSON.stringify(body, null, 4) : '')
        }

        return fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Accept': 'application/json',
                'Content-type': 'application/json',
                'Authorization': `Token ${this.devOpsAccessToken}`
            }
        })
    }
}

module.exports = Informer