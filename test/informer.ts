import assert from "assert"
import http from "http"
import Informer from "../src/informer"

class HTTPRequest {
    private readonly accessToken: string | undefined
    private readonly url: string | undefined
    private readonly method: string | undefined
    private readonly body: string

    constructor(accessToken: string | undefined,
        url: string | undefined,
        method: string | undefined,
        body: string) {
        this.accessToken = accessToken
        this.url = url
        this.method = method
        this.body = body
    }
}

describe("Informer", () => {
    const TEST_SERVER_PORT = 51843
    const TOKEN = "YQoijTHJOwt4y8bPtPmLNFpbS2TT8C3SmL6WP9QCGJjlH7iyaxyTBKGJHG5KE8eu"
    let server: http.Server
    let informer: Informer
    let requests: Array<HTTPRequest>

    function requestHandler(request: http.IncomingMessage, response: http.ServerResponse): void {
        let body = ""
        request.on("data", (chunk: any): void => {
            body += chunk.toString()
        })
        request.on("end", (chunk: any): void => {
            requests.push(new HTTPRequest(
                request.headers["authorization"],
                request.url,
                request.method,
                body)
            )

        })
        response.end()
    }

    before(() => {
        server = http.createServer(requestHandler)
        server.listen(TEST_SERVER_PORT, (): void => {
            console.info(`Test server listening on port ${TEST_SERVER_PORT}`)
        })
    })

    after(() => {
        server.close((err: Error | undefined): void => {
            if (err != undefined) {
                console.error(`error while closing http server: ${err.message}`)
            }
        })
    })

    async function getSessionToken(): Promise<string> {
        return Promise.resolve(TOKEN)
    }

    beforeEach(() => {
        requests = []
        informer = new Informer(`http://127.0.0.1:${TEST_SERVER_PORT}`, getSessionToken)
    })

    it("setDeployed causes expected POST request", async () => {
        await informer.setDeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
            ownerAddress: "0x0",
            beneficiaryAddress: "0xF",
            pricePerSecond: 5,
            priceCurrency: "EUR",
            minimumSubscriptionInSeconds: 0
        })

        assert.strictEqual(requests.length, 1)
        assert.deepStrictEqual(requests[0], new HTTPRequest(
            "Bearer " + TOKEN,
            "/products/product-id/setDeployed",
            "POST",
            JSON.stringify({
                blockNumber: 0,
                blockIndex: 0,
                ownerAddress: "0x0",
                beneficiaryAddress: "0xF",
                pricePerSecond: 5,
                priceCurrency: "EUR",
                minimumSubscriptionInSeconds: 0
            }))
        )
    })

    it("setUndeployed causes expected POST request", async () => {
        await informer.setUndeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
        })

        assert.strictEqual(requests.length, 1)
        assert.deepStrictEqual(requests[0], new HTTPRequest(
            "Bearer " + TOKEN,
            "/products/product-id/setUndeployed",
            "POST",
            JSON.stringify({
                blockNumber: 0,
                blockIndex: 0
            }))
        )
    })
})
