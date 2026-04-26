import fs from "node:fs/promises";
import path from "node:path";

import { commands, type Disposable, Uri, window, workspace } from "vscode";

import { readOptions } from "./options";
import { createCssModulePath, resolveCssModuleTargetFolder } from "./utils/create-css-module";

export const CREATE_CSS_MODULE_COMMAND = "enhancedCssModules.createCssModule";

interface CreateCssModuleCommandArgs {
	sourceUri?: Uri;
	folderUri?: Uri;
	skipLocationPrompt?: boolean;
}

interface LocationPick {
	label: string;
	description?: string;
	folderUri?: Uri;
	target: "configured" | "next" | "choose";
}

export function registerCreateCssModuleCommand(): Disposable {
	return commands.registerCommand(CREATE_CSS_MODULE_COMMAND, (args?: CreateCssModuleCommandArgs) =>
		createCssModuleForOpenFile(args)
	);
}

async function createCssModuleForOpenFile(args?: CreateCssModuleCommandArgs): Promise<void> {
	const sourceUri = getSourceUri(args);
	if (!sourceUri) {
		void window.showErrorMessage("Open a file before creating a CSS module.");
		return;
	}

	const targetFolderUri = await selectTargetFolder(sourceUri, args);
	if (!targetFolderUri) {
		return;
	}

	const cssModulePath = createCssModulePath(sourceUri.fsPath, targetFolderUri.fsPath);
	const cssModuleUri = Uri.file(cssModulePath);

	try {
		await fs.mkdir(path.dirname(cssModulePath), { recursive: true });
		await fs.writeFile(cssModulePath, "", { flag: "wx" });
		await openCssModule(cssModuleUri);
		void window.showInformationMessage(`Created ${path.basename(cssModulePath)}.`);
	} catch (error) {
		if (isFileExistsError(error)) {
			const openFile = "Open File";
			const choice = await window.showWarningMessage(`${path.basename(cssModulePath)} already exists.`, openFile);
			if (choice === openFile) {
				await openCssModule(cssModuleUri);
			}
			return;
		}

		void window.showErrorMessage(`Could not create CSS module: ${getErrorMessage(error)}`);
	}
}

function getSourceUri(args?: CreateCssModuleCommandArgs): Uri | undefined {
	if (args?.sourceUri?.scheme === "file") {
		return args.sourceUri;
	}

	const document = window.activeTextEditor?.document;
	return document?.uri.scheme === "file" ? document.uri : undefined;
}

async function selectTargetFolder(sourceUri: Uri, args?: CreateCssModuleCommandArgs): Promise<Uri | undefined> {
	if (args?.folderUri) {
		return args.folderUri;
	}

	const sourceFolderUri = Uri.file(path.dirname(sourceUri.fsPath));
	const configuredFolderUri = getConfiguredTargetFolderUri(sourceUri);
	if (args?.skipLocationPrompt) {
		return configuredFolderUri || sourceFolderUri;
	}

	const picks: LocationPick[] = [];
	if (configuredFolderUri) {
		picks.push({
			label: "Configured folder",
			description: configuredFolderUri.fsPath,
			folderUri: configuredFolderUri,
			target: "configured"
		});
	}

	picks.push(
		{
			label: "Next to current file",
			description: sourceFolderUri.fsPath,
			folderUri: sourceFolderUri,
			target: "next"
		},
		{
			label: "Choose folder...",
			target: "choose"
		}
	);

	const pick = await window.showQuickPick<LocationPick>(picks, {
		ignoreFocusOut: true,
		placeHolder: "Where should the CSS module be created?"
	});

	if (!pick) {
		return undefined;
	}

	if (pick.folderUri) {
		return pick.folderUri;
	}

	const selectedFolders = await window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		defaultUri: sourceFolderUri,
		openLabel: "Create Here",
		title: "Choose CSS Module Folder"
	});

	return selectedFolders?.[0];
}

function getConfiguredTargetFolderUri(sourceUri: Uri): Uri | undefined {
	const targetFolder = readOptions().createCssModuleTargetFolder;
	if (!targetFolder.trim()) {
		return undefined;
	}

	const workspaceFolder = workspace.getWorkspaceFolder(sourceUri);
	const resolvedFolder = resolveCssModuleTargetFolder(sourceUri.fsPath, targetFolder, workspaceFolder?.uri.fsPath);
	return Uri.file(resolvedFolder);
}

async function openCssModule(uri: Uri): Promise<void> {
	const document = await workspace.openTextDocument(uri);
	await window.showTextDocument(document, { preview: false });
}

function isFileExistsError(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
