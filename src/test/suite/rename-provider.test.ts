import * as assert from "assert";
import * as path from "node:path";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleRenameProvider } from "../../rename-provider";
import { FIXTURES_PATH } from "../constant";
import { readOptions } from "../utils";

const renameCssFile = path.join(FIXTURES_PATH, "rename.css");
const renameTsxFile = path.join(FIXTURES_PATH, "rename.tsx");
const token = { isCancellationRequested: false } as any;

test("renames dot usages to camelCase when new CSS class is dashed", async () => {
	const document = await vscode.workspace.openTextDocument(renameTsxFile);
	const provider = createCSSModuleRenameProvider(
		readOptions({
			camelCase: true
		})
	);

	const edit = await provider.provideRenameEdits(document, new vscode.Position(2, 4), "icon-primary", token);
	assert.ok(edit);

	const entries = edit.entries();
	const cssEdits = entries.find(([uri]) => uri.fsPath === renameCssFile)?.[1] || [];
	const usageEdits = entries.find(([uri]) => uri.fsPath === renameTsxFile)?.[1] || [];

	assert.deepStrictEqual(
		cssEdits.map(item => item.newText),
		["icon-primary"]
	);
	assert.deepStrictEqual(usageEdits.map(item => item.newText).sort(), ["icon-primary", "iconPrimary"]);
});

test("does not rename usages inside strings or comments", async () => {
	const document = await vscode.workspace.openTextDocument(renameTsxFile);
	const provider = createCSSModuleRenameProvider(
		readOptions({
			camelCase: true
		})
	);

	const edit = await provider.provideRenameEdits(document, new vscode.Position(2, 4), "icon-primary", token);
	assert.ok(edit);

	const usageEdits = edit.entries().find(([uri]) => uri.fsPath === renameTsxFile)?.[1] || [];
	assert.deepStrictEqual(
		usageEdits.map(item => [item.range.start.line, item.range.start.character, item.newText]),
		[
			[2, 3, "iconPrimary"],
			[3, 4, "icon-primary"]
		]
	);
});

test("does not prepare rename inside strings or comments", async () => {
	const document = await vscode.workspace.openTextDocument(renameTsxFile);
	const provider = createCSSModuleRenameProvider(readOptions());

	assert.strictEqual(await provider.prepareRename(document, new vscode.Position(4, 21), token), null);
	assert.strictEqual(await provider.prepareRename(document, new vscode.Position(6, 6), token), null);
	assert.strictEqual(await provider.prepareRename(document, new vscode.Position(7, 7), token), null);
});
