import * as fs from "node:fs/promises";
import * as path from "node:path";

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
import { type ClassTransformer, getClassTransformer, toCamelCase } from "./utils";
import { type CssClass, findCssClasses, getCssClassesFromFile, getUsageNamesForCssName } from "./utils/class-names";
import { getSourcePathCandidates } from "./utils/create-css-module";
import { findCssModuleImports, findImportModuleInDocument, resolveImportPath } from "./utils/path";
import { type CssModuleUsage, findUsageRangesForClassNames, getCssModuleUsageAtPosition } from "./utils/usages";

interface UsageTarget {
	kind: "usage";
	importName: string;
	importPath: string;
	cssName: string;
	className: string;
	classRange: Range;
	syntax: "dot" | "bracket";
}

interface CssTarget {
	kind: "css";
	className: string;
	classRange: Range;
}

type RenameTarget = UsageTarget | CssTarget;

interface RenameNames {
	cssName: string;
	usageName: string;
}

interface RenameContext {
	classTransformer: ClassTransformer | null;
}

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
		const classTransformer = getClassTransformer(currentOptions.camelCase);
		const usage = getCssModuleUsageAtPosition(document, position);
		if (!usage) return null;

		const importModule = findImportModuleInDocument(document, usage.importName);
		if (!importModule) return null;

		const importPath = await resolveImportPath(
			importModule,
			path.dirname(document.uri.fsPath),
			await getRealPathAlias(currentOptions.pathAlias, document)
		);
		if (!importPath || token.isCancellationRequested) return null;
		if (isInNodeModules(importPath)) return null;

		const cssClass = await findMatchingCssClass(importPath, usage.className, usage.syntax, classTransformer);
		if (!cssClass) return null;

		return {
			kind: "usage",
			importName: usage.importName,
			importPath,
			cssName: cssClass.name,
			className: usage.className,
			classRange: usage.classRange,
			syntax: usage.syntax
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

	async function renameFromUsage(
		document: TextDocument,
		target: UsageTarget,
		newName: string
	): Promise<WorkspaceEdit | null> {
		return createUsageRenameEdit(document, target, newName, {
			classTransformer: getClassTransformer(resolveOptions(options).camelCase)
		});
	}

	async function renameFromCss(
		document: TextDocument,
		target: CssTarget,
		newName: string,
		token: CancellationToken
	): Promise<WorkspaceEdit | null> {
		return createCssRenameEdit(document, target, newName, token, {
			classTransformer: getClassTransformer(resolveOptions(options).camelCase)
		});
	}

	return {
		async prepareRename(
			document: TextDocument,
			position: Position,
			token: CancellationToken
		): Promise<Range | { range: Range; placeholder: string }> {
			const target = await getRenameTarget(document, position, token);
			if (!target) return null;

			return {
				range: target.classRange,
				placeholder: target.kind === "usage" ? target.cssName : target.className
			};
		},

		async provideRenameEdits(
			document: TextDocument,
			position: Position,
			newName: string,
			token: CancellationToken
		): Promise<WorkspaceEdit> {
			const target = await getRenameTarget(document, position, token);
			if (!target) return null;

			if (target.kind === "usage") {
				return renameFromUsage(document, target, newName);
			}

			return renameFromCss(document, target, newName, token);
		}
	};
}

async function findMatchingCssClass(
	filePath: string,
	className: string,
	syntax: CssModuleUsage["syntax"],
	classTransformer: ClassTransformer | null
): Promise<CssClass | null> {
	const classes = await getCssClassesFromFile(filePath);
	return (
		classes.find(cssClass => {
			if (cssClass.name === className) return true;
			if (syntax === "bracket") return false;
			return getUsageNamesForCssName(cssClass.name, classTransformer).includes(className);
		}) ?? null
	);
}

async function createUsageRenameEdit(
	document: TextDocument,
	target: UsageTarget,
	newName: string,
	context: RenameContext
): Promise<WorkspaceEdit | null> {
	const cssClass = await findMatchingCssClass(
		target.importPath,
		target.className,
		target.syntax,
		context.classTransformer
	);
	if (!cssClass) return null;

	const names = normalizeRename(newName, context.classTransformer);
	if (!names) return null;

	const edit = new WorkspaceEdit();
	edit.replace(Uri.file(target.importPath), cssClass.range, names.cssName);

	replaceUsageRanges(edit, document, target.importName, cssClass.name, names, context.classTransformer);

	return edit;
}

async function createCssRenameEdit(
	document: TextDocument,
	target: CssTarget,
	newName: string,
	token: CancellationToken,
	context: RenameContext
): Promise<WorkspaceEdit | null> {
	const names = normalizeRename(newName, context.classTransformer);
	if (!names) return null;

	const edit = new WorkspaceEdit();

	for (const cssClass of findCssClasses(document.getText())) {
		if (cssClass.name === target.className) {
			edit.replace(document.uri, cssClass.range, names.cssName);
		}
	}

	const importers = await findCssModuleImporters(document.uri, token);
	for (const importer of importers) {
		if (token.isCancellationRequested) return null;

		const sourceDocument = await workspace.openTextDocument(importer.uri);
		replaceUsageRanges(edit, sourceDocument, importer.importName, target.className, names, context.classTransformer);
	}

	return edit;
}

function replaceUsageRanges(
	edit: WorkspaceEdit,
	document: TextDocument,
	importName: string,
	oldCssName: string,
	names: RenameNames,
	classTransformer: ClassTransformer | null
): void {
	const oldUsageNames = getUsageNamesForCssName(oldCssName, classTransformer);
	for (const usage of findUsageRangesForClassNames(document, importName, oldUsageNames)) {
		const replacement = usage.syntax === "bracket" ? names.cssName : names.usageName;
		edit.replace(document.uri, usage.range, replacement);
	}
}

function normalizeRename(newName: string, classTransformer: ClassTransformer | null): RenameNames | null {
	const trimmedName = newName.trim().replace(/^\./, "");
	if (!trimmedName || !isValidClassName(trimmedName)) return null;

	return {
		cssName: trimmedName,
		usageName: classTransformer ? classTransformer(trimmedName) : toCamelCase(trimmedName)
	};
}

function isValidClassName(className: string): boolean {
	return /^[_A-Za-z-][_A-Za-z0-9-]*$/.test(className);
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
