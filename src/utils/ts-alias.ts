import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as JSON5 from "json5";
import * as vscode from "vscode";

import { type AliasFromTsConfig } from "../options";
import { WORKSPACE_FOLDER_VARIABLE } from "./constants";

type TsConfigPaths = Record<string, string[]>;
const cachedMappings = new Map<string, AliasFromTsConfig>();

function invalidateCache(workfolder: vscode.WorkspaceFolder) {
	cachedMappings.delete(workfolder.name);
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

export function _getAliasFromTsConfigPaths(tsconfig: {
	compilerOptions: {
		baseUrl: string;
		paths: TsConfigPaths;
	};
}): AliasFromTsConfig | null {
	function removeTrailingSlash(str: string) {
		return str.endsWith("/") ? str.slice(0, -1) : str;
	}
	function joinPath(p: string) {
		return path.join(WORKSPACE_FOLDER_VARIABLE, baseUrl, removeTrailingSlash(p));
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

	const cachedMapping = cachedMappings.get(workfolder.name);
	if (cachedMapping) {
		return cachedMapping;
	}

	const include = new vscode.RelativePattern(workfolder, "[tj]sconfig.json");
	const exclude = new vscode.RelativePattern(workfolder, "**/node_modules/**");
	const files = await vscode.workspace.findFiles(include, exclude);

	let mapping: AliasFromTsConfig = {};
	for (let i = 0; i < files.length; i++) {
		try {
			const fileContent = await fs.readFile(files[i].fsPath, { encoding: "utf8" });
			const configFile = JSON5.parse(fileContent);
			const aliasFromPaths = _getAliasFromTsConfigPaths(configFile);
			if (aliasFromPaths) {
				mapping = { ...mapping, ...aliasFromPaths };
			}
		} catch {
			console.error(`Error parsing tsconfig.json: ${files[i].fsPath}`);
		}
	}

	cachedMappings.set(workfolder.name, mapping);
	return mapping;
}

export function subscribeToTsConfigChanges(): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = [];
	for (const workfolder of vscode.workspace.workspaceFolders || []) {
		const pattern = new vscode.RelativePattern(workfolder, "[tj]sconfig.json");
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => invalidateCache(workfolder));
		disposables.push(fileWatcher);
	}
	return disposables;
}
