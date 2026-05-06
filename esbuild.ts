import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "out");

const commonOptions = {
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node20",
	sourcemap: true,
	minify: !watch,
	external: ["vscode"],
	logLevel: "info"
};

const vscodeTestMockPlugin = {
	name: "vscode-test-mock",
	setup(build) {
		build.onResolve({ filter: /^vscode$/ }, () => ({
			path: path.join(root, "src", "test", "vscode-mock.ts")
		}));
	}
};

async function getTestEntryPoints(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async entry => {
			const filePath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				return getTestEntryPoints(filePath);
			}

			return entry.isFile() && entry.name.endsWith(".test.ts") ? [filePath] : [];
		})
	);

	return files.flat();
}

async function getBuildOptions() {
	const testEntryPoints = await getTestEntryPoints(path.join(root, "src", "test", "suite"));

	return [
		{
			...commonOptions,
			entryPoints: [path.join(root, "src", "extension.ts")],
			outfile: path.join(outDir, "extension.js")
		},
		...testEntryPoints.map(entryPoint => ({
			...commonOptions,
			entryPoints: [entryPoint],
			outfile: path.join(outDir, "test", "suite", path.basename(entryPoint, ".ts") + ".js"),
			plugins: [vscodeTestMockPlugin]
		}))
	];
}

async function build() {
	if (!watch) {
		await rm(outDir, { recursive: true, force: true });
	}

	await mkdir(outDir, { recursive: true });
	const buildOptions = await getBuildOptions();

	if (watch) {
		const contexts = await Promise.all(buildOptions.map(options => esbuild.context(options)));
		await Promise.all(contexts.map(context => context.watch()));
		console.log("Watching extension sources...");
		return;
	}

	await Promise.all(buildOptions.map(options => esbuild.build(options)));
}

build().catch(error => {
	console.error(error);
	process.exit(1);
});
