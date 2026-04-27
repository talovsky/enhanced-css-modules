import assert from "node:assert";
import * as path from "node:path";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleRenameProvider } from "../../rename-provider";
import { FIXTURES_PATH } from "../constant";
import { readOptions } from "../utils";

const renameCssFile = path.join(FIXTURES_PATH, "rename.css");
const renameTsxFile = path.join(FIXTURES_PATH, "rename.tsx");
const token = { isCancellationRequested: false } as any;

test("renames invalid asIs dot usages to bracket syntax", async () => {
	const document = await vscode.workspace.openTextDocument(renameTsxFile);
	const provider = createCSSModuleRenameProvider(readOptions());

	const edit = await provider.provideRenameEdits(document, new vscode.Position(2, 4), "icon-primary", token);
	assert.ok(edit);

	const usageEdits = edit.entries().find(([uri]) => uri.fsPath === renameTsxFile)?.[1] || [];
	assert.deepStrictEqual(
		usageEdits.map(item => [item.range.start.line, item.range.start.character, item.newText]),
		[
			[2, 2, `["icon-primary"]`],
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

test("does not match converted class names", async () => {
	const document = await vscode.workspace.openTextDocument(renameTsxFile);
	const provider = createCSSModuleRenameProvider(readOptions());

	assert.strictEqual(await provider.prepareRename(document, new vscode.Position(8, 6), token), null);
});
