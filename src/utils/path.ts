import * as fs from "node:fs/promises";
import * as path from "node:path";

import { PathAlias } from "../options";

export interface CssModuleImport {
	importName: string;
	moduleName: string;
}

async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

export function genImportRegExp(key: string): RegExp {
	const file = "(.+\\.(\\S{1,2}ss|stylus|styl))";
	const fromOrRequire = "(?:from\\s+|=\\s+require(?:<any>)?\\()";
	const requireEndOptional = "\\)?";
	const pattern = `\\s${key}\\s+${fromOrRequire}["']${file}["']${requireEndOptional}`;
	return new RegExp(pattern);
}

export function findCssModuleImports(text: string): CssModuleImport[] {
	const importRe =
		/\s([A-Za-z_$][\w$]*)\s+(?:from\s+|=\s+require(?:<any>)?\()["'](.+\.(?:\S{1,2}ss|stylus|styl))["']\)?/g;
	const imports: CssModuleImport[] = [];
	let match: RegExpExecArray | null;

	while ((match = importRe.exec(text)) !== null) {
		imports.push({
			importName: match[1],
			moduleName: match[2]
		});
	}

	return imports;
}

async function resolveAliasPath(
	moduleName: string,
	aliasPrefix: string,
	aliasPath: string | string[]
): Promise<string> {
	const prefix = aliasPrefix.endsWith("/") ? aliasPrefix : aliasPrefix + "/";
	const replacedModuleName = moduleName.replace(prefix, "");

	const paths = typeof aliasPath === "string" ? [aliasPath] : aliasPath;
	for (const aliasTarget of paths) {
		const targetPath = path.resolve(aliasTarget, replacedModuleName);
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
	return findCssModuleImports(text).find(item => item.importName === key)?.moduleName || "";
}
