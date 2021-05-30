module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "parser": "@typescript-eslint/parser",
    "plugins": [
        "@typescript-eslint"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1,
                "flatTernaryExpressions": true
            },
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "never"
        ],
        "no-console": "warn",
        "keyword-spacing": "error",
        "func-call-spacing": "error",
        "space-infix-ops": "error",
        "@typescript-eslint/no-var-requires": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "off"
    },
    "globals": {
        "describe": "readonly",
        "it": "readonly",
        "before": "readonly",
        "beforeEach": "readonly",
        "after": "readonly",
        "afterEach": "readonly",
    },
    "overrides": [
        {
            "files": ["src/*_test.ts"],
            "rules": {
                "no-console": 0,
            }
        }
    ]
}
