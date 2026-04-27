import path from "node:path";

import type { CancellationToken, TextDocument } from "vscode";

import type { AliasFromUserOptions } from "../options";
import { getRealPathAlias } from "../path-alias";
import { findImportModuleInDocument, resolveImportPath } from "./path";

export interface ResolvedCssModuleImport {
	importModule: string;
	importPath: string;
}

export async function resolveCssModuleImport(
	document: TextDocument,
	importName: string,
	pathAlias: AliasFromUserOptions,
	token?: CancellationToken
): Promise<ResolvedCssModuleImport | null> {
	const importModule = findImportModuleInDocument(document, importName);
	if (!importModule) {
		return null;
	}

	const importPath = await resolveCssModulePath(document, importModule, pathAlias, token);
	return importPath ? { importModule, importPath } : null;
}

export async function resolveCssModulePath(
	document: TextDocument,
	importModule: string,
	pathAlias: AliasFromUserOptions,
	token?: CancellationToken
): Promise<string | null> {
	const realPathAlias = await getRealPathAlias(pathAlias, document);
	if (token?.isCancellationRequested) {
		return null;
	}

	const importPath = await resolveImportPath(importModule, path.dirname(document.uri.fsPath), realPathAlias);
	if (!importPath || token?.isCancellationRequested) {
		return null;
	}

	return importPath;
}
