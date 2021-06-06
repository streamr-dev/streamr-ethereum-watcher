import log from "./log"
import fetch, {Response} from "node-fetch"

export default class CoreAPIClient {
    private readonly streamrUrl: string

    constructor(streamrUrl: string,
                private readonly getSessionTokenFunc: (privateKey: string) => Promise<string>,
                private readonly privateKey: string) {
        if (!streamrUrl) {
            throw new Error("No streamUrl given")
        }
        if (streamrUrl.endsWith("/")) {
            this.streamrUrl = streamrUrl.slice(0, streamrUrl.length - 1)
        } else {
            this.streamrUrl = streamrUrl
        }
        if (!getSessionTokenFunc) {
            throw new Error("No getSessionToken() function given")
        }
        if (!privateKey) {
            throw new Error("No privateKey given")
        }
    }

    async setDeployed(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setDeployed`
        return this._post(apiUrl, body)
    }

    async setUndeployed(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setUndeployed`
        return this._post(apiUrl, body)
    }

    async productUpdated(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setPricing`
        return this._post(apiUrl, body)
    }

    async subscribe(body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/subscriptions`
        return this._post(apiUrl, body)
    }

    async _post(apiUrl: string, body: any): Promise<Response> {
        let logBody = ""
        if (body) {
            logBody = JSON.stringify(body)
        }
        log.info("Watcher/CoreAPIClient > POST", apiUrl, logBody)

        return this.getSessionTokenFunc(this.privateKey)
            .then(async (sessionToken: string): Promise<Response> => {
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
