import assert from "node:assert";
import test from "node:test";

import * as vscode from "vscode";

import { createCSSModuleCompletionProvider } from "../../completion-provider";
import {
	SAMPLE_ASTRO_FILE,
	SAMPLE_JS_FILE,
	SAMPLE_REACT_FILE,
	SAMPLE_TSX_FILE,
	SAMPLE_TS_FILE,
	STYLUS_TSX_FILE
} from "../constant";
import { readOptions } from "../utils";

const uri = vscode.Uri.file(SAMPLE_REACT_FILE);
const uri2 = vscode.Uri.file(STYLUS_TSX_FILE);
const uri3 = vscode.Uri.file(SAMPLE_JS_FILE);
const uri4 = vscode.Uri.file(SAMPLE_TSX_FILE);
const uri5 = vscode.Uri.file(SAMPLE_TS_FILE);
const uri6 = vscode.Uri.file(SAMPLE_ASTRO_FILE);

function testCompletion(position: vscode.Position, itemCount: number, fixtureFile?: vscode.Uri) {
	return vscode.workspace.openTextDocument(fixtureFile || uri).then(text => {
		const provider = createCSSModuleCompletionProvider(readOptions());
		return provider.provideCompletionItems(text, position).then(items => {
			assert.strictEqual(itemCount, items.length);
		});
	});
}

test("test es6 style completion", () => {
	const position = new vscode.Position(3, 20);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test commonJS style completion", () => {
	const position = new vscode.Position(4, 20);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test optional chain invalid match to fix issue #22", () => {
	const position = new vscode.Position(11, 4);
	return Promise.resolve(testCompletion(position, 0)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test optional chain valid match", () => {
	const position = new vscode.Position(12, 12);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test bracket notation with double quotes and no closing quote valid match", () => {
	const position = new vscode.Position(17, 12);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test bracket notation with single quotes and no closing quote valid match", () => {
	const position = new vscode.Position(18, 12);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test bracket notation with double quotes and closing quote valid match", () => {
	const position = new vscode.Position(19, 9);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test bracket notation with single quotes and closing quote valid match", () => {
	const position = new vscode.Position(20, 9);
	return Promise.resolve(testCompletion(position, 5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test exact Match", () => {
	const position = new vscode.Position(14, 7);
	return Promise.resolve(testCompletion(position, 0)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test mix code style .styl completion", () => {
	const position = new vscode.Position(6, 27);
	return Promise.resolve(testCompletion(position, 3, uri2)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test .stylus extname stylus completion", () => {
	const position = new vscode.Position(8, 27);
	return Promise.resolve(testCompletion(position, 5, uri2)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("test kebab-case class name completion shows label as-is", async () => {
	const position = new vscode.Position(5, 21);
	const text = await vscode.workspace.openTextDocument(uri);
	const provider = createCSSModuleCompletionProvider(readOptions());
	const items = await provider.provideCompletionItems(text, position);
	assert.strictEqual(1, items.length);
	assert.strictEqual("sidebar_without-header", items[0].label);
});

test("test kebab-case class name completion inserts bracket notation", async () => {
	const position = new vscode.Position(5, 21);
	const text = await vscode.workspace.openTextDocument(uri);
	const provider = createCSSModuleCompletionProvider(readOptions());
	const items = await provider.provideCompletionItems(text, position);
	assert.strictEqual(1, items.length);
	assert.strictEqual(items[0].insertText, `["sidebar_without-header"]`);
});

test("support jsx", () => {
	const position = new vscode.Position(3, 20);
	return Promise.resolve(testCompletion(position, 5, uri)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("support js", () => {
	const position = new vscode.Position(3, 25);
	return Promise.resolve(testCompletion(position, 5, uri3)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("support tsx", () => {
	const position = new vscode.Position(7, 25);
	return Promise.resolve(testCompletion(position, 5, uri4)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("support ts", () => {
	const position = new vscode.Position(7, 25);
	return Promise.resolve(testCompletion(position, 5, uri5)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});

test("support astro", () => {
	const position = new vscode.Position(8, 28);
	return Promise.resolve(testCompletion(position, 5, uri6)).catch(err => {
		assert.ok(false, `error in OpenTextDocument ${err}`);
	});
});
