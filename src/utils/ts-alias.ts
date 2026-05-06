import fs from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

import { type AliasFromTsConfig } from "../options";
import { WORKSPACE_FOLDER_VARIABLE } from "./constants";
import { parseJsonc } from "./parse-jsonc";
import { measurePerformance } from "./performance";

type TsConfigPaths = Record<string, string[]>;
const cachedMappings = new Map<string, AliasFromTsConfig>();

function invalidateCache(workfolder: vscode.WorkspaceFolder) {
	cachedMappings.delete(getWorkspaceFolderCacheKey(workfolder));
}

function getWorkspaceFolderCacheKey(workfolder: vscode.WorkspaceFolder): string {
	return workfolder.uri.fsPath;
}

export function _removePathsSign(paths: TsConfigPaths): TsConfigPaths {
	const formatPaths: TsConfigPaths = {};
	function removeEndSign(str: string) {
		return str.endsWith("*") ? str.slice(0, -1) : str;
	}

	Object.keys(paths).forEach(k => {
		formatPaths[removeEndSign(k)] = paths[k].map(removeEndSign);
	});

	return formatPaths;
}

export function _getAliasFromTsConfigPaths(
	tsconfig: {
		compilerOptions: {
			baseUrl: string;
			paths: TsConfigPaths;
		};
	},
	configFolderPath = WORKSPACE_FOLDER_VARIABLE
): AliasFromTsConfig | null {
	function removeTrailingSlash(str: string) {
		return str.endsWith("/") ? str.slice(0, -1) : str;
	}
	function joinPath(p: string) {
		return path.join(configFolderPath, baseUrl, removeTrailingSlash(p));
	}

	let paths = tsconfig?.compilerOptions?.paths;
	const baseUrl = tsconfig?.compilerOptions?.baseUrl;
	if (!baseUrl || !paths || Object.keys(paths).length === 0) {
		return null;
	}

	paths = _removePathsSign(paths);
	const pathAlias: AliasFromTsConfig = {};
	Object.keys(paths).forEach(k => {
		pathAlias[removeTrailingSlash(k)] = paths[k].map(joinPath);
	});

	return pathAlias;
}

export async function getTsAlias(workfolder?: vscode.WorkspaceFolder): Promise<AliasFromTsConfig> {
	if (!workfolder) {
		return {};
	}

	const cacheKey = getWorkspaceFolderCacheKey(workfolder);
	const cachedMapping = cachedMappings.get(cacheKey);
	if (cachedMapping) {
		return cachedMapping;
	}

	return measurePerformance(`tsconfig aliases ${workfolder.name}`, async () => {
		const include = new vscode.RelativePattern(workfolder, "**/[tj]sconfig.json");
		const exclude = new vscode.RelativePattern(workfolder, "**/{node_modules,out,dist,build,.next,coverage}/**");
		const files = await vscode.workspace.findFiles(include, exclude);

		let mapping: AliasFromTsConfig = {};
		for (const file of files) {
			try {
				const fileContent = await fs.readFile(file.fsPath, { encoding: "utf8" });
				const configFile = parseJsonc(fileContent) as Parameters<typeof _getAliasFromTsConfigPaths>[0];
				const aliasFromPaths = _getAliasFromTsConfigPaths(configFile, path.dirname(file.fsPath));
				if (aliasFromPaths) {
					mapping = { ...mapping, ...aliasFromPaths };
				}
			} catch {
				console.error(`Error parsing tsconfig.json: ${file.fsPath}`);
			}
		}

		cachedMappings.set(cacheKey, mapping);
		return mapping;
	});
}

export function subscribeToTsConfigChanges(): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	for (const workfolder of vscode.workspace.workspaceFolders || []) {
		const pattern = new vscode.RelativePattern(workfolder, "**/[tj]sconfig.json");
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => invalidateCache(workfolder));
		fileWatcher.onDidCreate(() => invalidateCache(workfolder));
		fileWatcher.onDidDelete(() => invalidateCache(workfolder));
		disposables.push(fileWatcher);
	}
	return disposables;
}
