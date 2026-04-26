import fs from "node:fs/promises";
import path from "node:path";

import { commands, type Disposable, RelativePattern, Uri, window, workspace } from "vscode";

import { readOptions } from "./options";
import {
	getCssModulePathCandidates,
	getSourceFileNameCandidates,
	getSourcePathCandidates,
	isCssModulePath,
	isCssModuleSourcePath,
	resolveCssModuleTargetFolder
} from "./utils/create-css-module";

export const TOGGLE_CSS_MODULE_COMMAND = "enhancedCssModules.toggleCssModule";

interface ToggleCssModuleCommandArgs {
	sourceUri?: Uri;
}

export function registerToggleCssModuleCommand(): Disposable {
	return commands.registerCommand(TOGGLE_CSS_MODULE_COMMAND, (args?: ToggleCssModuleCommandArgs) =>
		toggleCssModuleForOpenFile(args)
	);
}

async function toggleCssModuleForOpenFile(args?: ToggleCssModuleCommandArgs): Promise<void> {
	const sourceUri = getSourceUri(args);
	if (!sourceUri) {
		void window.showErrorMessage("Open a file before toggling to its CSS module.");
		return;
	}

	const targetUri = isCssModulePath(sourceUri.fsPath)
		? await findSourceFile(sourceUri)
		: await findCssModuleFile(sourceUri);

	if (!targetUri) {
		void window.showInformationMessage(
			`No matching CSS module counterpart found for ${path.basename(sourceUri.fsPath)}.`
		);
		return;
	}

	const document = await workspace.openTextDocument(targetUri);
	await window.showTextDocument(document, { preview: false });
}

function getSourceUri(args?: ToggleCssModuleCommandArgs): Uri | undefined {
	if (args?.sourceUri?.scheme === "file") {
		return args.sourceUri;
	}

	const document = window.activeTextEditor?.document;
	return document?.uri.scheme === "file" ? document.uri : undefined;
}

async function findCssModuleFile(sourceUri: Uri): Promise<Uri | undefined> {
	if (!isCssModuleSourcePath(sourceUri.fsPath)) {
		return undefined;
	}

	const sourceFolderPath = path.dirname(sourceUri.fsPath);
	const targetFolderPaths = getUniqueValues([getConfiguredTargetFolderPath(sourceUri), sourceFolderPath]);
	const targetPath = await findExistingPath(getCssModulePathCandidates(sourceUri.fsPath, targetFolderPaths));
	return targetPath ? Uri.file(targetPath) : undefined;
}

async function findSourceFile(cssModuleUri: Uri): Promise<Uri | undefined> {
	const cssModuleFolderPath = path.dirname(cssModuleUri.fsPath);
	const targetPath = await findExistingPath(getSourcePathCandidates(cssModuleUri.fsPath, [cssModuleFolderPath]));
	if (targetPath) {
		return Uri.file(targetPath);
	}

	return findSourceFileInWorkspace(cssModuleUri);
}

function getConfiguredTargetFolderPath(sourceUri: Uri): string | undefined {
	const targetFolder = readOptions().createCssModuleTargetFolder;
	if (!targetFolder.trim()) {
		return undefined;
	}

	const workspaceFolder = workspace.getWorkspaceFolder(sourceUri);
	return resolveCssModuleTargetFolder(sourceUri.fsPath, targetFolder, workspaceFolder?.uri.fsPath);
}

async function findExistingPath(paths: string[]): Promise<string | undefined> {
	for (const candidatePath of paths) {
		if (await pathExists(candidatePath)) {
			return candidatePath;
		}
	}

	return undefined;
}

async function findSourceFileInWorkspace(cssModuleUri: Uri): Promise<Uri | undefined> {
	const workspaceFolder = workspace.getWorkspaceFolder(cssModuleUri);
	if (!workspaceFolder) {
		return undefined;
	}

	const exclude = new RelativePattern(workspaceFolder, "**/node_modules/**");
	for (const fileName of getSourceFileNameCandidates(cssModuleUri.fsPath)) {
		const matches = await workspace.findFiles(new RelativePattern(workspaceFolder, `**/${fileName}`), exclude, 1);
		if (matches[0]) {
			return matches[0];
		}
	}

	return undefined;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

function getUniqueValues(values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}
