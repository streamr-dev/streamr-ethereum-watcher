import log from "./log"
import fetch, {RequestInfo, RequestInit, Response} from "node-fetch"
import StreamrClient from "streamr-client"

const defaultGetSessionTokenFunc = async function (privateKey: string, streamrUrl: string): Promise<string> {
    const client = new StreamrClient({
        restUrl: streamrUrl,
        auth: {
            privateKey: privateKey,
        }
    })
    return client.session.getSessionToken()
}

type getSessionTokenFunc = (privateKey: string, streamrUrl: string) => Promise<string>

type fetchFunc = (url: RequestInfo, init?: RequestInit) => Promise<Response>

export default class CoreAPIClient {
    public static DEFAULT_GET_SESSION_TOKEN_FUNC: getSessionTokenFunc = defaultGetSessionTokenFunc
    public static DEFAULT_FETCH_FUNC: fetchFunc = fetch
    private readonly streamrUrl: string

    constructor(streamrUrl: string,
                private readonly nodeFetch: fetchFunc,
                private readonly getSessionTokenFunc: getSessionTokenFunc,
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

    async getProduct(id: string): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/products/${id}`
        return this._get(apiUrl)
    }

    async subscribe(body: any): Promise<Response> {
        const apiUrl = `${this.streamrUrl}/subscriptions`
        return this._post(apiUrl, body)
    }

    private async _post(apiUrl: string, body: any, method = "POST"): Promise<Response> {
        let logBody = ""
        if (body) {
            logBody = JSON.stringify(body)
        }
        log.info("Watcher/CoreAPIClient > POST", apiUrl, logBody)

        return this.getSessionTokenFunc(this.privateKey, this.streamrUrl)
            .then(async (sessionToken: string): Promise<Response> => {
                return this.nodeFetch(apiUrl, {
                    method,
                    body: JSON.stringify(body),
                    headers: {
                        "Accept": "application/json",
                        "Content-type": "application/json",
                        "Authorization": `Bearer ${sessionToken}`
                    }
                })
            })
    }

    private async _get(apiUrl: string): Promise<Response> {
        log.info("Watcher/CoreAPIClient > GET ", apiUrl)

        return this.getSessionTokenFunc(this.privateKey, this.streamrUrl)
            .then(async (sessionToken: string): Promise<Response> => {
                return this.nodeFetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Content-type": "application/json",
                        "Authorization": `Bearer ${sessionToken}`
                    }
                })
            })
    }
}
