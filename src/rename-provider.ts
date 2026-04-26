import fs from "node:fs/promises";
import path from "node:path";

import {
	type CancellationToken,
	type Position,
	type Range,
	type TextDocument,
	Uri,
	WorkspaceEdit,
	workspace
} from "vscode";

import { type ExtensionOptionsProvider, resolveOptions } from "./options";
import { getRealPathAlias } from "./path-alias";
import { findCssClasses, getCssClassesFromFile, type CssClass } from "./utils/class-names";
import { getSourcePathCandidates } from "./utils/create-css-module";
import { findCssModuleImports, findImportModuleInDocument, resolveImportPath } from "./utils/path";
import { measurePerformance } from "./utils/performance";
import { findUsageRangesForClassNames, getCssModuleUsageAtPosition } from "./utils/usages";

interface UsageTarget {
	kind: "usage";
	importName: string;
	importPath: string;
	cssName: string;
	className: string;
	classRange: Range;
}

interface CssTarget {
	kind: "css";
	className: string;
	classRange: Range;
}

type RenameTarget = UsageTarget | CssTarget;

export function createCSSModuleRenameProvider(options: ExtensionOptionsProvider) {
	async function getRenameTarget(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<RenameTarget | null> {
		if (isInNodeModules(document.uri.fsPath)) {
			return null;
		}

		if (isCssModuleDocument(document)) {
			return getCssTarget(document, position);
		}

		return getUsageTarget(document, position, token);
	}

	async function getUsageTarget(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): Promise<UsageTarget | null> {
		const currentOptions = resolveOptions(options);
		const usage = getCssModuleUsageAtPosition(document, position);
		if (!usage) return null;

		const importModule = findImportModuleInDocument(document, usage.importName);
		if (!importModule) return null;

		const realPathAlias = await getRealPathAlias(currentOptions.pathAlias, document);
		if (token.isCancellationRequested) return null;

		const importPath = await resolveImportPath(importModule, path.dirname(document.uri.fsPath), realPathAlias);
		if (!importPath || token.isCancellationRequested) return null;
		if (isInNodeModules(importPath)) return null;

		const cssClass = await findMatchingCssClass(importPath, usage.className);
		if (!cssClass || token.isCancellationRequested) return null;

		return {
			kind: "usage",
			importName: usage.importName,
			importPath,
			cssName: cssClass.name,
			className: usage.className,
			classRange: usage.classRange
		};
	}

	function getCssTarget(document: TextDocument, position: Position): CssTarget | null {
		const cssClass = findCssClasses(document.getText()).find(item => item.range.contains(position));
		if (!cssClass) return null;

		return {
			kind: "css",
			className: cssClass.name,
			classRange: cssClass.range
		};
	}

	return {
		async prepareRename(
			document: TextDocument,
			position: Position,
			token: CancellationToken
		): Promise<Range | { range: Range; placeholder: string }> {
			return measurePerformance(
				"rename.prepare",
				async () => {
					const target = await getRenameTarget(document, position, token);
					if (!target) return null;

					return {
						range: target.classRange,
						placeholder: target.kind === "usage" ? target.cssName : target.className
					};
				},
				resolveOptions(options).debugPerformance
			);
		},

		async provideRenameEdits(
			document: TextDocument,
			position: Position,
			newName: string,
			token: CancellationToken
		): Promise<WorkspaceEdit> {
			return measurePerformance(
				"rename.edits",
				async () => {
					const target = await getRenameTarget(document, position, token);
					if (!target) return null;

					if (target.kind === "usage") {
						return createUsageRenameEdit(document, target, newName);
					}

					return createCssRenameEdit(document, target, newName, token);
				},
				resolveOptions(options).debugPerformance
			);
		}
	};
}

async function findMatchingCssClass(filePath: string, className: string): Promise<CssClass | null> {
	const classes = await getCssClassesFromFile(filePath);
	return classes.find(c => c.name === className) ?? null;
}

async function createUsageRenameEdit(
	document: TextDocument,
	target: UsageTarget,
	newName: string
): Promise<WorkspaceEdit | null> {
	const cssClass = await findMatchingCssClass(target.importPath, target.className);
	if (!cssClass) return null;

	const normalizedName = normalizeRename(newName);
	if (!normalizedName) return null;

	const edit = new WorkspaceEdit();
	edit.replace(Uri.file(target.importPath), cssClass.range, normalizedName);

	replaceUsageRanges(edit, document, target.importName, cssClass.name, normalizedName);

	return edit;
}

async function createCssRenameEdit(
	document: TextDocument,
	target: CssTarget,
	newName: string,
	token: CancellationToken
): Promise<WorkspaceEdit | null> {
	const normalizedName = normalizeRename(newName);
	if (!normalizedName) return null;

	const edit = new WorkspaceEdit();

	for (const cssClass of findCssClasses(document.getText())) {
		if (cssClass.name === target.className) {
			edit.replace(document.uri, cssClass.range, normalizedName);
		}
	}

	const importers = await findCssModuleImporters(document.uri, token);
	for (const importer of importers) {
		if (token.isCancellationRequested) return null;

		const sourceDocument = await workspace.openTextDocument(importer.uri);
		replaceUsageRanges(edit, sourceDocument, importer.importName, target.className, normalizedName);
	}

	return edit;
}

function replaceUsageRanges(
	edit: WorkspaceEdit,
	document: TextDocument,
	importName: string,
	oldCssName: string,
	newCssName: string
): void {
	for (const usage of findUsageRangesForClassNames(document, importName, [oldCssName])) {
		const replacement = getUsageReplacement(usage, newCssName);
		edit.replace(document.uri, replacement.range, replacement.text);
	}
}

function getUsageReplacement(
	usage: ReturnType<typeof findUsageRangesForClassNames>[number],
	newCssName: string
): { range: Range; text: string } {
	if (usage.syntax === "bracket") {
		return { range: usage.range, text: newCssName };
	}

	if (isValidPropertyAccessName(newCssName)) {
		return { range: usage.range, text: newCssName };
	}

	const prefix = usage.operator === "?." ? "?." : "";
	return { range: usage.accessRange, text: `${prefix}["${newCssName}"]` };
}

function normalizeRename(newName: string): string | null {
	const trimmedName = newName.trim().replace(/^\./, "");
	return trimmedName && isValidClassName(trimmedName) ? trimmedName : null;
}

function isValidClassName(className: string): boolean {
	return /^[_A-Za-z-][_A-Za-z0-9-]*$/.test(className);
}

function isValidPropertyAccessName(className: string): boolean {
	return /^[$_A-Za-z][$\w]*$/.test(className);
}

function isCssModuleDocument(document: TextDocument): boolean {
	return /\.(?:module\.)?(?:css|scss|sass|less|styl|stylus)$/.test(document.uri.fsPath);
}

function isInNodeModules(fsPath: string): boolean {
	return fsPath.split(path.sep).includes("node_modules");
}

async function findCssModuleImporters(
	cssUri: Uri,
	token: CancellationToken
): Promise<{ uri: Uri; importName: string }[]> {
	const cssDir = path.dirname(cssUri.fsPath);
	const cssNormalized = path.normalize(cssUri.fsPath);
	const candidates = getSourcePathCandidates(cssUri.fsPath, [cssDir]);
	const importers: { uri: Uri; importName: string }[] = [];

	for (const candidatePath of candidates) {
		if (token.isCancellationRequested) break;

		const content = await readTextFile(candidatePath);
		if (content !== null) {
			const dirname = path.dirname(candidatePath);
			for (const item of findCssModuleImports(content)) {
				if (path.normalize(path.resolve(dirname, item.moduleName)) === cssNormalized) {
					importers.push({ uri: Uri.file(candidatePath), importName: item.importName });
				}
			}
		}
	}

	return importers;
}

async function readTextFile(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, { encoding: "utf8" });
	} catch {
		return null;
	}
}

export default createCSSModuleRenameProvider;
