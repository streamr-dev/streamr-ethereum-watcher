import {strict as assert} from "assert"
import {getEnv} from "../src/env"

describe("OS environment variables", () => {
    it("gets variable from environment", () => {
        process.env.TEST_VAR = "hello"
        assert.equal(getEnv("TEST_VAR"), "hello")
    })
    it("undefined variable is an empty string", () => {
        process.env.TEST_VAR = undefined
        assert.equal(getEnv("TEST_VAR"), "")
    })
})
