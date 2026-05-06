import assert from "node:assert";
import path from "node:path";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleDefinitionProvider } from "../../definition-provider";
import {
	FIXTURES_PATH,
	JUMP_PRECISE_DEF_FILE,
	SAMPLE_REACT_FILE,
	SPREAD_SYNTAX_FILE,
	STYLUS_TSX_FILE,
	VITE_IMPORT_FILE
} from "../constant";
import { readOptions } from "../utils";

const uri = vscode.Uri.file(SAMPLE_REACT_FILE);
const uri2 = vscode.Uri.file(JUMP_PRECISE_DEF_FILE);
const uri3 = vscode.Uri.file(STYLUS_TSX_FILE);

async function getDefinitionLineAndChar(position: vscode.Position, fixtureFile?: vscode.Uri) {
	const location = await getDefinitionLocation(position, fixtureFile);
	if (!location) return null;

	const { line, character } = location.range.start;
	return {
		line,
		character
	};
}

async function getDefinitionLocation(position: vscode.Position, fixtureFile?: vscode.Uri) {
	const text = await vscode.workspace.openTextDocument(fixtureFile || uri);
	const provider = createCSSModuleDefinitionProvider(readOptions());
	const result = await provider.provideDefinition(text, position, undefined);
	if (!result) return null;

	const location = Array.isArray(result) ? result[0] : result;
	return location || null;
}

async function getDefinitions(position: vscode.Position, fixtureFile: vscode.Uri, token?: vscode.CancellationToken) {
	const text = await vscode.workspace.openTextDocument(fixtureFile);
	const provider = createCSSModuleDefinitionProvider(readOptions());
	const result = await provider.provideDefinition(text, position, token);
	if (!result) return [];

	return Array.isArray(result) ? result : [result];
}

async function testDefinition(
	position: vscode.Position,
	lineNum: number,
	characterNum: number,
	fixtureFile?: vscode.Uri
) {
	const result = await getDefinitionLineAndChar(position, fixtureFile);
	assert.strictEqual(true, result.line === lineNum && result.character === characterNum);
}

test("testing es6 style definition", () => {
	const position = new vscode.Position(3, 21);
	return Promise.resolve(testDefinition(position, 4, 1)).catch(err =>
		assert.ok(true, `error in OpenTextDocument ${err}`)
	);
});

test("testing commonJS style definition", () => {
	const position = new vscode.Position(4, 21);
	return Promise.resolve(testDefinition(position, 4, 1)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing es6 import binding definition", () => {
	const position = new vscode.Position(0, 8);
	return Promise.resolve(testDefinition(position, 0, 0)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing es6 import path definition", () => {
	const position = new vscode.Position(0, 23);
	return Promise.resolve(testDefinition(position, 0, 0)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing es6 style jump to precise definition", () => {
	const position = new vscode.Position(4, 31);
	return Promise.resolve(testDefinition(position, 7, 1, uri2)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing commonJS style jump to precise definition", () => {
	const position = new vscode.Position(6, 30);
	return Promise.resolve(testDefinition(position, 7, 1, uri2)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing es6 style jump to precise definition case2", () => {
	const position = new vscode.Position(7, 30);
	return Promise.resolve(testDefinition(position, 19, 1, uri2)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing commonJS style jump to precise definition case2", () => {
	const position = new vscode.Position(8, 30);
	return Promise.resolve(testDefinition(position, 19, 1, uri2)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing stylus @css jump to definition", () => {
	const position = new vscode.Position(5, 31);
	return Promise.resolve(testDefinition(position, 14, 3, uri3)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing stylus indent classname jump to definition", () => {
	const position = new vscode.Position(6, 29);
	return Promise.resolve(testDefinition(position, 4, 3, uri3)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing stylus CSS-like syntax classname jump to definition", () => {
	const position = new vscode.Position(4, 27);
	return Promise.resolve(testDefinition(position, 10, 1, uri3)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("testing stylus nest classname jump to definition", () => {
	const position = new vscode.Position(6, 29);
	return Promise.resolve(testDefinition(position, 4, 3, uri3)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("ignore spread syntax", async () => {
	const position = new vscode.Position(3, 15);
	const result = await getDefinitionLineAndChar(position, vscode.Uri.file(SPREAD_SYNTAX_FILE));
	assert.deepStrictEqual(result, null);
});

test("test bracket definition with double quotes jump to definition", () => {
	const position = new vscode.Position(23, 22);
	return Promise.resolve(testDefinition(position, 4, 1)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("test bracket definition with single quotes jump to definition", () => {
	const position = new vscode.Position(24, 22);
	return Promise.resolve(testDefinition(position, 4, 1)).catch(err =>
		assert.ok(false, `error in OpenTextDocument ${err}`)
	);
});

test("css module class definition prefers JSX usages", async () => {
	const definitions = await getDefinitions(
		new vscode.Position(0, 2),
		vscode.Uri.file(path.join(FIXTURES_PATH, "references.module.css"))
	);

	assert.strictEqual(definitions.length, 3);
	assert.strictEqual(definitions[0].uri.fsPath, path.join(FIXTURES_PATH, "references.tsx"));
	assert.strictEqual(definitions[0].range.start.line, 2);
	assert.strictEqual(definitions[0].range.start.character, 7);
});

test("vite css module import binding resolves to css file", async () => {
	const location = await getDefinitionLocation(new vscode.Position(0, 8), vscode.Uri.file(VITE_IMPORT_FILE));

	assert.strictEqual(location.uri.fsPath, path.join(FIXTURES_PATH, "component.module.css"));
	assert.strictEqual(location.range.start.line, 0);
	assert.strictEqual(location.range.start.character, 0);
});

test("vite css module import path resolves to css file", async () => {
	const location = await getDefinitionLocation(new vscode.Position(0, 22), vscode.Uri.file(VITE_IMPORT_FILE));

	assert.strictEqual(location.uri.fsPath, path.join(FIXTURES_PATH, "component.module.css"));
	assert.strictEqual(location.range.start.line, 0);
	assert.strictEqual(location.range.start.character, 0);
});
