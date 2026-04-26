import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { TextDocument } from "vscode";

import type { PathAlias } from "../options";

export interface CssModuleImport {
	importName: string;
	moduleName: string;
}

interface CachedDocumentImports {
	version: number;
	imports: CssModuleImport[];
}

const documentImportCache = new WeakMap<TextDocument, CachedDocumentImports>();

async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

export function genImportRegExp(key: string): RegExp {
	const file = String.raw`(.+\.(\S{1,2}ss|stylus|styl))`;
	const fromOrRequire = String.raw`(?:from\s+|=\s+require(?:<any>)?\()`;
	const requireEndOptional = String.raw`\)?`;
	const pattern = `\\s${key}\\s+${fromOrRequire}["']${file}["']${requireEndOptional}`;
	return new RegExp(pattern);
}

export function findCssModuleImports(text: string): CssModuleImport[] {
	const importRe =
		/\s([A-Za-z_$][\w$]*)\s+(?:from\s+|=\s+require(?:<any>)?\()["'](.+\.(?:\S{1,2}ss|stylus|styl))["']\)?/g;
	const imports: CssModuleImport[] = [];

	for (let match = importRe.exec(text); match !== null; match = importRe.exec(text)) {
		imports.push({
			importName: match[1],
			moduleName: match[2]
		});
	}

	return imports;
}

export function findImportModuleFromImports(imports: CssModuleImport[], key: string): string {
	return imports.find(item => item.importName === key)?.moduleName || "";
}

export function getCssModuleImportsFromDocument(document: TextDocument): CssModuleImport[] {
	const version = document.version ?? -1;
	const cached = documentImportCache.get(document);
	if (cached && cached.version === version) {
		return cached.imports;
	}

	const imports = findCssModuleImports(document.getText());
	documentImportCache.set(document, { version, imports });
	return imports;
}

export function findImportModuleInDocument(document: TextDocument, key: string): string {
	return findImportModuleFromImports(getCssModuleImportsFromDocument(document), key);
}

async function resolveAliasPath(
	moduleName: string,
	aliasPrefix: string,
	aliasPath: string | string[]
): Promise<string> {
	const prefix = aliasPrefix.endsWith("/") ? aliasPrefix : `${aliasPrefix}/`;
	const replacedModuleName = moduleName.replace(prefix, "");

	const paths = typeof aliasPath === "string" ? [aliasPath] : aliasPath;
	for (const aliasTarget of paths) {
		const targetPath = path.resolve(`${aliasTarget}`, replacedModuleName);
		if (await pathExists(targetPath)) {
			return targetPath;
		}
	}

	return "";
}

export async function resolveImportPath(
	moduleName: string,
	currentDirPath: string,
	pathAlias: PathAlias
): Promise<string> {
	const realPath = path.resolve(currentDirPath, moduleName);
	if (await pathExists(realPath)) {
		return realPath;
	}

	const aliasPrefix = Object.keys(pathAlias).find(prefix => moduleName.startsWith(prefix));
	if (aliasPrefix) {
		const aliasPath = pathAlias[aliasPrefix];
		return resolveAliasPath(moduleName, aliasPrefix, aliasPath);
	}

	return "";
}

export function findImportModule(text: string, key: string): string {
	return findImportModuleFromImports(findCssModuleImports(text), key);
}
