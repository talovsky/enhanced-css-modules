import * as assert from "assert";
import * as path from "node:path";
import test from "node:test";

import {
	createCssModuleFileName,
	createCssModulePath,
	getCssModulePathCandidates,
	getSourceFileNameCandidates,
	getSourcePathCandidates,
	resolveCssModuleTargetFolder
} from "../../utils/create-css-module";

test("creates a css module file name from the source file name", () => {
	assert.strictEqual(createCssModuleFileName("/workspace/src/Button.tsx"), "Button.module.css");
	assert.strictEqual(createCssModuleFileName("/workspace/src/Button.test.tsx"), "Button.test.module.css");
});

test("creates a css module path next to the source file by default", () => {
	assert.strictEqual(
		createCssModulePath(path.join("workspace", "src", "Button.tsx")),
		path.join("workspace", "src", "Button.module.css")
	);
});

test("creates a css module path in a selected target folder", () => {
	assert.strictEqual(
		createCssModulePath(path.join("workspace", "src", "Button.tsx"), path.join("workspace", "styles")),
		path.join("workspace", "styles", "Button.module.css")
	);
});

test("resolves an empty target folder next to the source file", () => {
	assert.strictEqual(
		resolveCssModuleTargetFolder(path.join("workspace", "src", "Button.tsx"), ""),
		path.join("workspace", "src")
	);
});

test("resolves a relative target folder from the workspace folder", () => {
	assert.strictEqual(
		resolveCssModuleTargetFolder(path.join("workspace", "src", "Button.tsx"), "styles", path.resolve("workspace")),
		path.resolve("workspace", "styles")
	);
});

test("resolves workspace folder variables in a target folder", () => {
	assert.strictEqual(
		resolveCssModuleTargetFolder(
			path.join("workspace", "src", "Button.tsx"),
			"${workspaceFolder}/styles",
			path.resolve("workspace")
		),
		path.resolve("workspace", "styles")
	);
});

test("creates exact and kebab-case css module candidates for source files", () => {
	assert.deepStrictEqual(getCssModulePathCandidates(path.join("workspace", "src", "ButtonPrimary.tsx"), ["styles"]), [
		path.join("styles", "ButtonPrimary.module.css"),
		path.join("styles", "button-primary.module.css")
	]);
});

test("creates source candidates for kebab-case css module files", () => {
	assert.deepStrictEqual(
		getSourceFileNameCandidates(path.join("workspace", "styles", "button-primary.module.css")).slice(0, 6),
		[
			"button-primary.tsx",
			"button-primary.jsx",
			"button-primary.ts",
			"button-primary.js",
			"button-primary.astro",
			"ButtonPrimary.tsx"
		]
	);
});

test("creates source path candidates for css module files", () => {
	assert.deepStrictEqual(
		getSourcePathCandidates(path.join("workspace", "styles", "button-primary.module.css"), ["src"]).slice(0, 6),
		[
			path.join("src", "button-primary.tsx"),
			path.join("src", "button-primary.jsx"),
			path.join("src", "button-primary.ts"),
			path.join("src", "button-primary.js"),
			path.join("src", "button-primary.astro"),
			path.join("src", "ButtonPrimary.tsx")
		]
	);
});
