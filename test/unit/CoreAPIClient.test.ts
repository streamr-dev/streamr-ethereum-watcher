import {strict as assert} from "assert"
import http from "http"
import CoreAPIClient from "../../src/CoreAPIClient"
const TEST_SERVER_PORT = 51843

class HTTPRequest {
    constructor(private readonly accessToken: string | undefined,
                private readonly url: string | undefined,
                private readonly method: string | undefined,
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                private readonly body: any) {
        this.accessToken = accessToken
        this.url = url
        this.method = method
        this.body = body
    }
}

describe("CoreAPIClient", () => {
    let server: http.Server
    let apiClient: CoreAPIClient
    let requests: Array<HTTPRequest>
    const TOKEN = "YQoijTHJOwt4y8bPtPmLNFpbS2TT8C3SmL6WP9QCGJjlH7iyaxyTBKGJHG5KE8eu"

    before(() => {
        server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse): void => {
            let body = ""
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            request.on("data", (chunk: any): void => {
                body += chunk.toString()
            })
            request.on("end", (chunk: any[]): void => { // eslint-disable-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                requests.push(new HTTPRequest(
                    request.headers.authorization,
                    request.url,
                    request.method,
                    JSON.parse(body)
                ))
            })
            response.end()
        })
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

    beforeEach(() => {
        requests = []
        const privateKey = "15f6a8f106f5438f975faf9b87772026a6fe047034e6b34577fc023a64909db3"

        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        const getSessionToken = async function(privateKey: string): Promise<string> {
            return Promise.resolve(TOKEN)
        }

        apiClient = new CoreAPIClient(
            `http://127.0.0.1:${TEST_SERVER_PORT}`,
            CoreAPIClient.DEFAULT_FETCH_FUNC,
            getSessionToken,
            privateKey)
    })

    it("setDeployed causes expected POST request", async () => {
        await apiClient.setDeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
            ownerAddress: "0x0",
            beneficiaryAddress: "0xF",
            pricePerSecond: 5,
            priceCurrency: "EUR",
            minimumSubscriptionInSeconds: 0
        })

        assert.equal(requests.length, 1)
        assert.deepEqual(requests[0], new HTTPRequest(
            "Bearer " + TOKEN,
            "/products/product-id/setDeployed",
            "POST",
            {
                blockNumber: 0,
                blockIndex: 0,
                ownerAddress: "0x0",
                beneficiaryAddress: "0xF",
                pricePerSecond: 5,
                priceCurrency: "EUR",
                minimumSubscriptionInSeconds: 0
            })
        )
    })

    it("setUndeployed causes expected POST request", async () => {
        await apiClient.setUndeployed("product-id", {
            blockNumber: 0,
            blockIndex: 0,
        })

        assert.equal(requests.length, 1)
        assert.deepEqual(requests[0], new HTTPRequest(
            "Bearer " + TOKEN,
            "/products/product-id/setUndeployed",
            "POST",
            {
                blockNumber: 0,
                blockIndex: 0
            }
        ))
    })
})
