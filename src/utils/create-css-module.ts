import path from "node:path";

import { WORKSPACE_FOLDER_VARIABLE } from "./constants";

export const CSS_MODULE_EXTENSION = ".module.css";
export const CSS_MODULE_SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js", ".astro"];

export function createCssModuleFileName(sourceFilePath: string): string {
	const parsedPath = path.parse(sourceFilePath);
	return `${parsedPath.name}${CSS_MODULE_EXTENSION}`;
}

export function createCssModulePath(sourceFilePath: string, targetFolderPath = path.dirname(sourceFilePath)): string {
	return path.join(targetFolderPath, createCssModuleFileName(sourceFilePath));
}

export function resolveCssModuleTargetFolder(
	sourceFilePath: string,
	targetFolder: string,
	workspaceFolderPath?: string
): string {
	const trimmedTargetFolder = targetFolder.trim();
	if (!trimmedTargetFolder) {
		return path.dirname(sourceFilePath);
	}

	const resolvedVariables = workspaceFolderPath
		? trimmedTargetFolder.replaceAll(WORKSPACE_FOLDER_VARIABLE, workspaceFolderPath)
		: trimmedTargetFolder;

	if (path.isAbsolute(resolvedVariables)) {
		return resolvedVariables;
	}

	return path.resolve(workspaceFolderPath || path.dirname(sourceFilePath), resolvedVariables);
}

export function getCssModulePathCandidates(sourceFilePath: string, targetFolderPaths: string[]): string[] {
	const parsedPath = path.parse(sourceFilePath);
	const moduleBaseNames = getUniqueValues([parsedPath.name, toKebabCase(parsedPath.name)]);

	return getUniqueValues(
		targetFolderPaths.flatMap(folderPath =>
			moduleBaseNames.map(moduleBaseName => path.join(folderPath, `${moduleBaseName}${CSS_MODULE_EXTENSION}`))
		)
	);
}

export function getSourcePathCandidates(cssModuleFilePath: string, sourceFolderPaths: string[]): string[] {
	return getUniqueValues(
		sourceFolderPaths.flatMap(folderPath =>
			getSourceFileNameCandidates(cssModuleFilePath).map(fileName => path.join(folderPath, fileName))
		)
	);
}

export function getSourceFileNameCandidates(cssModuleFilePath: string): string[] {
	const moduleBaseName = getCssModuleBaseName(cssModuleFilePath);
	if (!moduleBaseName) {
		return [];
	}

	const sourceBaseNames = getUniqueValues([moduleBaseName, toPascalCase(moduleBaseName), toCamelCase(moduleBaseName)]);
	return sourceBaseNames.flatMap(sourceBaseName =>
		CSS_MODULE_SOURCE_EXTENSIONS.map(extension => `${sourceBaseName}${extension}`)
	);
}

export function isCssModulePath(filePath: string): boolean {
	return path.basename(filePath).endsWith(CSS_MODULE_EXTENSION);
}

export function isCssModuleSourcePath(filePath: string): boolean {
	return CSS_MODULE_SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function getCssModuleBaseName(cssModuleFilePath: string): string {
	const fileName = path.basename(cssModuleFilePath);
	return fileName.endsWith(CSS_MODULE_EXTENSION) ? fileName.slice(0, -CSS_MODULE_EXTENSION.length) : "";
}

function toKebabCase(value: string): string {
	return getWords(value)
		.map(word => word.toLowerCase())
		.join("-");
}

function toPascalCase(value: string): string {
	return getWords(value)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

function toCamelCase(value: string): string {
	const pascalCase = toPascalCase(value);
	return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

function getWords(value: string): string[] {
	const normalized = value
		.trim()
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

	return normalized.match(/[A-Za-z0-9]+/g) || [];
}

function getUniqueValues(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}
