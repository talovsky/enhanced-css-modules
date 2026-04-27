import { defineConfig } from "oxlint";

export default defineConfig({
	plugins: ["typescript", "unicorn", "oxc", "promise"],
	categories: {
		correctness: "error",
		style: "warn"
	},
	rules: {
		"sort-imports": "off",
		"no-magic-numbers": "off",
		"sort-keys": "off",
		"max-statements": "off",
		"id-length": "off",
		"capitalized-comments": "off",
		"eslint/func-style": "off",
		"eslint/no-ternary": "off",
		"unicorn/no-null": "off",
		"eslint/guard-for-in": "off",
		"eslint/curly": "off",
		"eslint/max-params": [
			"off",
			{
				max: 5
			}
		]
	},
	env: {
		builtin: true
	},
	settings: {},
	ignorePatterns: ["node_modules", "out", "src/test/fixtures"]
});
