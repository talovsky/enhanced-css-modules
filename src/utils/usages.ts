import { Position, Range, type TextDocument } from "vscode";

import { findImportModule, genImportRegExp } from "./path";

export type UsageSyntax = "dot" | "bracket";

export interface CssModuleUsage {
	importName: string;
	className: string;
	classRange: Range;
	syntax: UsageSyntax;
}

export interface CssModuleUsageRange {
	range: Range;
	syntax: UsageSyntax;
}

export interface CssModuleClickInfo {
	importModule: string;
	targetClass: string;
}

export function getCssModuleClickInfo(document: TextDocument, position: Position): CssModuleClickInfo | null {
	const currentLine = document.getText(document.lineAt(position).range);
	const importModule = getImportModuleAtPosition(currentLine, position.character);
	if (importModule !== null) {
		return {
			importModule,
			targetClass: ""
		};
	}

	const usage = getCssModuleUsageAtPosition(document, position);
	if (!usage) {
		return null;
	}

	return {
		importModule: findImportModule(document.getText(), usage.importName),
		targetClass: usage.className
	};
}

export function getCssModuleUsageAtPosition(document: TextDocument, position: Position): CssModuleUsage | null {
	const line = document.getText(document.lineAt(position).range);
	const text = document.getText();
	const offset = document.offsetAt(position);
	const lineStart = document.offsetAt(new Position(position.line, 0));
	const lineOffset = offset - lineStart;
	const usageRe = /([A-Za-z_$][\w$]*)\s*(?:(\??\.)\s*([A-Za-z_$][\w$]*)|\[\s*(["'])([^"']+)\4\s*\])/g;
	let match: RegExpExecArray | null = null;

	while ((match = usageRe.exec(line)) !== null) {
		const syntax: UsageSyntax = match[2] === "." ? "dot" : "bracket";
		const className = syntax === "dot" ? match[3] : match[5];
		const classStart = match.index + match[0].lastIndexOf(className);
		const classEnd = classStart + className.length;
		if (lineOffset >= classStart && lineOffset <= classEnd && isCodeOffset(text, lineStart + match.index)) {
			return {
				importName: match[1],
				className,
				syntax,
				classRange: new Range(document.positionAt(lineStart + classStart), document.positionAt(lineStart + classEnd))
			};
		}
	}

	return null;
}

export function findUsageRanges(document: TextDocument, importName: string, className: string): CssModuleUsageRange[] {
	const text = document.getText();
	const ranges: CssModuleUsageRange[] = [];
	const escapedImport = escapeRegExp(importName);
	const escapedClass = escapeRegExp(className);
	const usageRe = new RegExp(
		`${escapedImport}\\s*(?:(?:\\??\\.\\s*(${escapedClass})(?![-\\w$]))|(?:\\[\\s*(["'])(${escapedClass})\\2\\s*\\]))`,
		"g"
	);
	let match: RegExpExecArray | null = null;

	while ((match = usageRe.exec(text)) !== null) {
		const foundName = match[1] || match[3];
		const classStart = match.index + match[0].lastIndexOf(foundName);
		if (isCodeOffset(text, match.index)) {
			ranges.push({
				range: new Range(document.positionAt(classStart), document.positionAt(classStart + foundName.length)),
				syntax: match[1] ? "dot" : "bracket"
			});
		}
	}

	return ranges;
}

function getImportModuleAtPosition(line: string, character: number): string | null {
	const matches = genImportRegExp(String.raw`(\S+)`).exec(line);
	if (matches === null) {
		return null;
	}

	const start1 = line.indexOf(matches[1]);
	const start2 = line.indexOf(matches[2]);
	const isInsideImport =
		isInsideRange(character, start2, matches[2].length) || isInsideRange(character, start1, matches[1].length);

	return isInsideImport ? matches[2] : null;
}

function isInsideRange(character: number, start: number, length: number): boolean {
	return character >= start && character <= start + length;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function isCodeOffset(text: string, offset: number): boolean {
	let state: "code" | "lineComment" | "blockComment" | "singleQuote" | "doubleQuote" | "template" = "code";
	let escaped = false;

	for (let i = 0; i < offset; i++) {
		const char = text[i];
		const next = text[i + 1];

		if (state === "lineComment") {
			if (char === "\n" || char === "\r") {
				state = "code";
			}
		} else if (state === "blockComment") {
			if (char === "*" && next === "/") {
				i++;
				state = "code";
			}
		} else if (state === "singleQuote" || state === "doubleQuote" || state === "template") {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (
				(state === "singleQuote" && char === "'") ||
				(state === "doubleQuote" && char === '"') ||
				(state === "template" && char === "`")
			) {
				state = "code";
			}
		} else if (char === "/" && next === "/") {
			i++;
			state = "lineComment";
		} else if (char === "/" && next === "*") {
			i++;
			state = "blockComment";
		} else if (char === "'") {
			state = "singleQuote";
		} else if (char === '"') {
			state = "doubleQuote";
		} else if (char === "`") {
			state = "template";
		}
	}

	return state === "code";
}
