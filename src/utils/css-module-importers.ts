import fs from "node:fs/promises";
import path from "node:path";

import { type CancellationToken, RelativePattern, Uri, workspace } from "vscode";

import { CSS_MODULE_SOURCE_EXTENSIONS, getSourcePathCandidates } from "./create-css-module";
import { findCssModuleImports } from "./path";

export interface CssModuleImporter {
	uri: Uri;
	importName: string;
}

export async function findCssModuleImporters(cssUri: Uri, token: CancellationToken): Promise<CssModuleImporter[]> {
	const cssDir = path.dirname(cssUri.fsPath);
	const cssNormalized = path.normalize(cssUri.fsPath);
	const candidates = [
		...getSourcePathCandidates(cssUri.fsPath, [cssDir]),
		...(await getSourceFileCandidates(cssUri, cssDir, token))
	];
	const importers: CssModuleImporter[] = [];
	const seenCandidatePaths = new Set<string>();

	for (const candidatePath of candidates) {
		if (token.isCancellationRequested) break;

		const candidate = await readTextFile(candidatePath);
		if (candidate !== null && !seenCandidatePaths.has(candidate.filePath)) {
			seenCandidatePaths.add(candidate.filePath);
			const dirname = path.dirname(candidate.filePath);
			for (const item of findCssModuleImports(candidate.content)) {
				if (path.normalize(path.resolve(dirname, item.moduleName)) === cssNormalized) {
					importers.push({ uri: Uri.file(candidate.filePath), importName: item.importName });
				}
			}
		}
	}

	return importers;
}

async function getSourceFileCandidates(cssUri: Uri, cssDir: string, token: CancellationToken): Promise<string[]> {
	const workspaceFolder = workspace.getWorkspaceFolder(cssUri);
	if (workspaceFolder) {
		const exclude = new RelativePattern(workspaceFolder, "**/{node_modules,out,dist,build,.next,coverage}/**");
		const matches = await Promise.all(
			CSS_MODULE_SOURCE_EXTENSIONS.map(extension =>
				workspace.findFiles(new RelativePattern(workspaceFolder, `**/*${extension}`), exclude)
			)
		);
		return matches.flat().map(uri => uri.fsPath);
	}

	return findSourceFilesInDirectory(cssDir, token);
}

async function findSourceFilesInDirectory(directoryPath: string, token: CancellationToken): Promise<string[]> {
	const files: string[] = [];
	await collectSourceFiles(directoryPath, files, token);
	return files;
}

async function collectSourceFiles(directoryPath: string, files: string[], token: CancellationToken): Promise<void> {
	if (token.isCancellationRequested || isIgnoredDirectory(directoryPath)) {
		return;
	}

	let entries;
	try {
		entries = await fs.readdir(directoryPath, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (token.isCancellationRequested) return;

		const entryPath = path.join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			await collectSourceFiles(entryPath, files, token);
		} else if (entry.isFile() && CSS_MODULE_SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
			files.push(entryPath);
		}
	}
}

function isIgnoredDirectory(directoryPath: string): boolean {
	return ["node_modules", "out", "dist", "build", ".next", "coverage"].includes(path.basename(directoryPath));
}

async function readTextFile(filePath: string): Promise<{ filePath: string; content: string } | null> {
	try {
		const realPath = await fs.realpath(filePath);
		const content = await fs.readFile(realPath, { encoding: "utf8" });
		return { filePath: realPath, content };
	} catch {
		return null;
	}
}
