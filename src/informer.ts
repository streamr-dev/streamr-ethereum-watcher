import log from "./log"
import fetch, {Response} from "node-fetch"

export default class Informer {
    constructor(
            private readonly streamrUrl: string,
            private readonly getSessionToken: () => Promise<string>) {
        if (!streamrUrl) {
            throw new Error("No streamUrl given")
        }
        if (streamrUrl.endsWith("/")) {
            this.streamrUrl = streamrUrl.slice(0, streamrUrl.length - 1)
        } else {
            this.streamrUrl = streamrUrl
        }
        if (!getSessionToken) {
            throw new Error("No StreamrClient.getSessionToken() function given")
        }
        this.getSessionToken = getSessionToken
    }

    setDeployed(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setDeployed`
        return this._post(apiUrl, body)
    }

    setUndeployed(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setUndeployed`
        return this._post(apiUrl, body)
    }

    productUpdated(id: string, body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}/setPricing`
        return this._post(apiUrl, body)
    }

    subscribe(body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/subscriptions`
        return this._post(apiUrl, body)
    }

    _post(apiUrl: string, body: any): Promise<Response> {
        let logBody = ""
        if (body) {
            logBody = JSON.stringify(body)
        }
        log.info("Watcher/Informer > POST", apiUrl, logBody)

        return this.getSessionToken()
            .then((sessionToken: string) =>
                fetch(apiUrl, {
                    method: "POST",
                    body: logBody,
                    headers: {
                        "Accept": "application/json",
                        "Content-type": "application/json",
                        "Authorization": `Bearer ${sessionToken}`
                    }
                })
            )
    }
}
