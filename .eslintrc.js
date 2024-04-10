module.exports = {
    "env": {
        "es2021": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "overrides": [
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
		"semi": [2, "always"],
		"no-unused-vars": 0,
		"space-infix-ops": ["error", { "int32Hint": false }]
    }
}
