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

    productUpdated(id, body) {
        const apiUrl = urlJoin(this.streamrUrl, `/products/${id}`)
        return this._post(apiUrl, body, 'PUT')
    }

    subscribe(body) {
        const apiUrl = urlJoin(this.streamrUrl, `/subscriptions`)
        return this._post(apiUrl, body)
    }

    _post(apiUrl, body, method='POST') {
        if (this.logging) {
            console.info(method, apiUrl, body ? '\n' + JSON.stringify(body, null, 4) : '')
        }

        return fetch(apiUrl, {
            method,
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