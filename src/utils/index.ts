import * as fs from "node:fs/promises";

import { Position, TextDocument, CompletionItem, CompletionItemKind, TextEdit, Range } from "vscode";

import { CamelCaseValues } from "../options";

export type ClassTransformer = (cls: string) => string;

export function getCurrentLine(document: TextDocument, position: Position): string {
	return document.getText(document.lineAt(position).range);
}

/**
 * @TODO Refact by new Tokenizer
 */
export async function getAllClassNames(filePath: string, keyword: string): Promise<string[]> {
	const filePathStat = await fs.stat(filePath).catch(() => null);
	if (!filePathStat?.isFile()) {
		return [];
	}

	const content = await fs.readFile(filePath, { encoding: "utf8" });
	let matchLineRegexp = /.*[,{]/g;

	// experimental stylus support
	if (filePath.endsWith(".styl") || filePath.endsWith(".stylus")) {
		matchLineRegexp = /\..*/g;
	}
	const lines = content.match(matchLineRegexp);
	if (lines === null) {
		return [];
	}

	const classNames = lines.join(" ").match(/\.[_A-Za-z0-9-]+/g);
	if (classNames === null) {
		return [];
	}

	const uniqNames = Array.from(new Set(classNames))
		.map(item => item.slice(1))
		.filter(item => !/^[0-9]/.test(item));
	return keyword !== "" ? uniqNames.filter(item => item.indexOf(keyword) !== -1) : uniqNames;
}

// from css-loader's implementation
// source: https://github.com/webpack-contrib/css-loader/blob/22f6621a175e858bb604f5ea19f9860982305f16/lib/compile-exports.js
export function dashesCamelCase(str: string): string {
	return str.replace(/-(\w)/g, function (match, firstLetter) {
		return firstLetter.toUpperCase();
	});
}

export function toCamelCase(str: string): string {
	const normalized = str
		.trim()
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
	const words = normalized.match(/[A-Za-z0-9]+/g);
	if (!words) {
		return "";
	}

	return words
		.map((word, index) => {
			const lowerWord = word.toLowerCase();
			return index === 0 ? lowerWord : `${lowerWord.charAt(0).toUpperCase()}${lowerWord.slice(1)}`;
		})
		.join("");
}

export function getClassTransformer(camelCaseConfig: CamelCaseValues): ClassTransformer | null {
	switch (camelCaseConfig) {
		case true:
		case "true":
			return toCamelCase;
		case "dashes":
			return dashesCamelCase;
		default:
			return null;
	}
}

/**
 * check kebab-case classname
 */
export function isKebabCaseClassName(className: string): boolean {
	return className?.includes("-");
}

/**
 * BracketCompletionItem Factory
 */
export function createBracketCompletionItem(className: string, position: Position, currentLine = ""): CompletionItem {
	const completionItem = new CompletionItem(className, CompletionItemKind.Variable);
	const beforeCursor = currentLine.slice(0, position.character);
	const afterCursor = currentLine.slice(position.character);
	const bracketMatch = /\[\s*(["'])[^"']*$/.exec(beforeCursor);

	completionItem.detail = `['${className}']`;
	completionItem.documentation =
		"kebab-casing may cause unexpected behavior when trying to access style.class-name as a dot notation. You can still work around kebab-case with bracket notation (eg. style['class-name']) but style.className is cleaner.";

	if (bracketMatch) {
		const quote = bracketMatch[1];
		completionItem.insertText = afterCursor.trimStart().startsWith(`${quote}]`) ? className : `${className}${quote}]`;
		return completionItem;
	}

	completionItem.insertText = `["${className}"]`;
	completionItem.additionalTextEdits = [
		new TextEdit(
			new Range(new Position(position.line, position.character - 1), new Position(position.line, position.character)),
			""
		)
	];
	return completionItem;
}
