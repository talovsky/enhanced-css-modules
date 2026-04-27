import assert from "node:assert";
import path from "node:path";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleReferenceProvider } from "../../reference-provider";
import { FIXTURES_PATH } from "../constant";

const referencesCssFile = path.join(FIXTURES_PATH, "references.module.css");
const referencesTsxFile = path.join(FIXTURES_PATH, "references.tsx");
const referencesConsumerFile = path.join(FIXTURES_PATH, "references-consumer.tsx");
const token = { isCancellationRequested: false } as any;

test("finds source references for a css module class", async () => {
	const document = await vscode.workspace.openTextDocument(referencesCssFile);
	const provider = createCSSModuleReferenceProvider();

	const locations = await provider.provideReferences(
		document,
		new vscode.Position(0, 2),
		{ includeDeclaration: false },
		token
	);

	assert.deepStrictEqual(
		locations.map(location => [location.uri.fsPath, location.range.start.line, location.range.start.character]),
		[
			[referencesTsxFile, 2, 7],
			[referencesTsxFile, 3, 8],
			[referencesConsumerFile, 2, 4]
		]
	);
});

test("does not duplicate css references from the built-in css provider", async () => {
	const document = await vscode.workspace.openTextDocument(referencesCssFile);
	const provider = createCSSModuleReferenceProvider();

	const locations = await provider.provideReferences(
		document,
		new vscode.Position(0, 2),
		{ includeDeclaration: true },
		token
	);

	assert.deepStrictEqual(
		locations.map(location => [location.uri.fsPath, location.range.start.line, location.range.start.character]),
		[
			[referencesTsxFile, 2, 7],
			[referencesTsxFile, 3, 8],
			[referencesConsumerFile, 2, 4]
		]
	);
});

test("returns no references for unused css module classes", async () => {
	const document = await vscode.workspace.openTextDocument(referencesCssFile);
	const provider = createCSSModuleReferenceProvider();

	const locations = await provider.provideReferences(
		document,
		new vscode.Position(3, 2),
		{ includeDeclaration: false },
		token
	);

	assert.deepStrictEqual(locations, []);
});
