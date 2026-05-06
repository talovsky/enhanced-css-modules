import { Position, Range, type TextDocument } from "vscode";

import { findImportModuleInDocument, genImportRegExp } from "./path";

export type UsageSyntax = "dot" | "bracket";

export interface CssModuleUsage {
	importName: string;
	className: string;
	classRange: Range;
	syntax: UsageSyntax;
}

export interface CssModuleUsageRange {
	range: Range;
	accessRange: Range;
	operator?: "." | "?.";
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
		importModule: findImportModuleInDocument(document, usage.importName),
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
	const nonCodeRanges = computeNonCodeRanges(text);
	let match: RegExpExecArray | null = null;

	while ((match = usageRe.exec(line)) !== null) {
		if (!isOffsetInCode(nonCodeRanges, lineStart + match.index)) {
			continue;
		}
		const syntax: UsageSyntax = match[2] === "." ? "dot" : "bracket";
		const className = syntax === "dot" ? match[3] : match[5];
		const classStart = match.index + match[0].lastIndexOf(className);
		const classEnd = classStart + className.length;
		const importEnd = match.index + match[1].length;
		if (lineOffset >= classStart && lineOffset <= classEnd) {
			return {
				importName: match[1],
				className,
				syntax,
				classRange: new Range(document.positionAt(lineStart + classStart), document.positionAt(lineStart + classEnd))
			};
		}
		if (lineOffset >= match.index && lineOffset <= importEnd) {
			return {
				importName: match[1],
				className: "",
				syntax,
				classRange: new Range(document.positionAt(lineStart + match.index), document.positionAt(lineStart + importEnd))
			};
		}
	}

	return null;
}

export function findUsageRanges(document: TextDocument, importName: string, className: string): CssModuleUsageRange[] {
	return findUsageRangesForClassNames(document, importName, [className]);
}

export function findUsageRangesForClassNames(
	document: TextDocument,
	importName: string,
	classNames: string[]
): CssModuleUsageRange[] {
	const text = document.getText();
	const ranges: CssModuleUsageRange[] = [];
	const escapedImport = escapeRegExp(importName);
	const classNameSet = new Set(classNames);
	const usageRe = new RegExp(
		`${escapedImport}\\s*(?:(\\??\\.)\\s*([A-Za-z_$][\\w$]*)(?![-\\w$])|(?:\\[\\s*(["'])([^"']+)\\3\\s*\\]))`,
		"g"
	);
	const nonCodeRanges = computeNonCodeRanges(text);
	let match: RegExpExecArray | null = null;

	while ((match = usageRe.exec(text)) !== null) {
		const foundName = match[2] || match[4];
		const classStart = match.index + match[0].lastIndexOf(foundName);
		const accessStart = match[1] ? match.index + match[0].lastIndexOf(match[1]) : classStart;
		if (classNameSet.has(foundName) && isOffsetInCode(nonCodeRanges, match.index)) {
			ranges.push({
				accessRange: new Range(document.positionAt(accessStart), document.positionAt(classStart + foundName.length)),
				operator: match[1] as "." | "?." | undefined,
				range: new Range(document.positionAt(classStart), document.positionAt(classStart + foundName.length)),
				syntax: match[2] ? "dot" : "bracket"
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

type NonCodeRange = readonly [number, number];

function computeNonCodeRanges(text: string): NonCodeRange[] {
	const ranges: NonCodeRange[] = [];
	const n = text.length;
	let i = 0;
	while (i < n) {
		const c = text[i];
		const next = text[i + 1];
		if (c === "/" && next === "/") {
			const start = i;
			i += 2;
			while (i < n && text[i] !== "\n" && text[i] !== "\r") i++;
			ranges.push([start, i]);
			continue;
		}
		if (c === "/" && next === "*") {
			const start = i;
			i += 2;
			while (i < n - 1 && !(text[i] === "*" && text[i + 1] === "/")) i++;
			i = Math.min(i + 2, n);
			ranges.push([start, i]);
			continue;
		}
		if (c === "'" || c === '"' || c === "`") {
			const quote = c;
			const start = i;
			i++;
			while (i < n) {
				if (text[i] === "\\") {
					i += 2;
					continue;
				}
				if (text[i] === quote) {
					i++;
					break;
				}
				i++;
			}
			ranges.push([start, i]);
			continue;
		}
		i++;
	}
	return ranges;
}

function isOffsetInCode(ranges: NonCodeRange[], offset: number): boolean {
	let lo = 0;
	let hi = ranges.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const [start, end] = ranges[mid];
		if (offset < start) hi = mid - 1;
		else if (offset >= end) lo = mid + 1;
		else return false;
	}
	return true;
}
