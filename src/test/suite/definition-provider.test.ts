import assert from "node:assert";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleDefinitionProvider } from "../../definition-provider";
import { type ClassNameConvention } from "../../options";
import { JUMP_PRECISE_DEF_FILE, SAMPLE_REACT_FILE, SPREAD_SYNTAX_FILE, STYLUS_TSX_FILE } from "../constant";
import { readOptions } from "../utils";

const uri = vscode.Uri.file(SAMPLE_REACT_FILE);
const uri2 = vscode.Uri.file(JUMP_PRECISE_DEF_FILE);
const uri3 = vscode.Uri.file(STYLUS_TSX_FILE);

function getDefinitionLineAndChar(position: vscode.Position, fixtureFile?: vscode.Uri) {
	return vscode.workspace.openTextDocument(fixtureFile || uri).then(text => {
		const provider = createCSSModuleDefinitionProvider(readOptions());
		return provider.provideDefinition(text, position, undefined).then(location => {
			if (!location) return null;

			const { line, character } = location.range.start;
			return {
				line,
				character
			};
		});
	});
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

function testDefinitionWithConvention(
	position: vscode.Position,
	classNameExportConvention: ClassNameConvention,
	assertions: any[]
) {
	return vscode.workspace.openTextDocument(uri).then(text => {
		const provider = createCSSModuleDefinitionProvider(
			readOptions({
				classNameExportConvention
			})
		);
		return provider.provideDefinition(text, position, undefined).then(location => {
			const position = location ? location.range.start : null;
			assertions.map(assertion => assertion(position));
		});
	});
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

test("test asIs convention does not match transformed definition", () => {
	const position = new vscode.Position(6, 21);
	return Promise.resolve(
		testDefinitionWithConvention(position, "asIs", [
			(position?: vscode.Position | null) => assert.strictEqual(position, null)
		])
	).catch(err => assert.ok(false, `error in OpenTextDocument ${err}`));
});

test("test camelCase convention style definition", () => {
	const position = new vscode.Position(6, 21);
	return Promise.resolve(
		testDefinitionWithConvention(position, "camelCase", [
			(position?: vscode.Position) => assert.strictEqual(true, position.line === 8 && position.character === 1)
		])
	).catch(err => assert.ok(false, `error in OpenTextDocument ${err}`));
});

test("test dashes convention style definition", () => {
	const position = new vscode.Position(7, 21);
	return Promise.resolve(
		testDefinitionWithConvention(position, "dashes", [
			(position?: vscode.Position) => assert.strictEqual(true, position.line === 8 && position.character === 1)
		])
	).catch(err => assert.ok(false, `error in OpenTextDocument ${err}`));
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
