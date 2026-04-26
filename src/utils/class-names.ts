import * as fs from "node:fs/promises";

import { Position, Range } from "vscode";

import { type ClassTransformer, dashesCamelCase, toCamelCase } from "./index";
import { measurePerformance } from "./performance";

interface CachedCssClasses {
	mtime: number;
	checkedAt: number;
	classes: CssClass[];
}

const MAX_CSS_CLASS_CACHE_ENTRIES = 200;
const CSS_CLASS_CACHE_STAT_TTL_MS = 1000;
const cssClassCache = new Map<string, CachedCssClasses>();

export async function getCssClassesFromFile(filePath: string): Promise<CssClass[]> {
	return measurePerformance(`css classes ${filePath}`, async () => {
		try {
			const cached = cssClassCache.get(filePath);
			const now = Date.now();
			if (cached && now - cached.checkedAt < CSS_CLASS_CACHE_STAT_TTL_MS) {
				rememberCssClasses(filePath, cached);
				return cached.classes;
			}

			const stat = await fs.stat(filePath);
			const mtime = stat.mtimeMs;
			if (cached && cached.mtime === mtime) {
				rememberCssClasses(filePath, { ...cached, checkedAt: now });
				return cached.classes;
			}
			const content = await fs.readFile(filePath, { encoding: "utf8" });
			const classes = findCssClasses(content);
			rememberCssClasses(filePath, { mtime, checkedAt: now, classes });
			return classes;
		} catch {
			return [];
		}
	});
}

export interface CssClass {
	name: string;
	range: Range;
}

export function findCssClasses(content: string): CssClass[] {
	const classes: CssClass[] = [];
	const classRe = /\.([_A-Za-z-][_A-Za-z0-9-]*)/g;
	const lineOffsets = buildLineOffsets(content);
	let match: RegExpExecArray | null = null;

	while ((match = classRe.exec(content)) !== null) {
		if (match.index === 0 || !/[_A-Za-z0-9-]/.test(content[match.index - 1])) {
			const start = match.index + 1;
			classes.push({
				name: match[1],
				range: rangeForOffset(lineOffsets, start, start + match[1].length)
			});
		}
	}

	return classes;
}

export function isClassNameMatch(
	cssClassName: string,
	className: string,
	classTransformer: ClassTransformer | null
): boolean {
	if (cssClassName === className) return true;
	if (classTransformer && classTransformer(cssClassName) === className) return true;

	return toCamelCase(cssClassName) === className || dashesCamelCase(cssClassName) === className;
}

export function getUsageNamesForCssName(cssName: string, classTransformer: ClassTransformer | null): string[] {
	return [
		...new Set(
			[
				classTransformer ? classTransformer(cssName) : null,
				toCamelCase(cssName),
				dashesCamelCase(cssName),
				cssName
			].filter(Boolean)
		)
	];
}

function rememberCssClasses(filePath: string, cachedClasses: CachedCssClasses): void {
	if (cssClassCache.has(filePath)) {
		cssClassCache.delete(filePath);
	}

	cssClassCache.set(filePath, cachedClasses);
	if (cssClassCache.size <= MAX_CSS_CLASS_CACHE_ENTRIES) {
		return;
	}

	const oldestKey = cssClassCache.keys().next().value;
	if (oldestKey) {
		cssClassCache.delete(oldestKey);
	}
}

function buildLineOffsets(content: string): number[] {
	const offsets = [0];
	for (let i = 0; i < content.length; i++) {
		if (content[i] === "\r") {
			if (content[i + 1] === "\n") i++;
			offsets.push(i + 1);
		} else if (content[i] === "\n") {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

function rangeForOffset(lineOffsets: number[], start: number, end: number): Range {
	return new Range(positionForOffset(lineOffsets, start), positionForOffset(lineOffsets, end));
}

function positionForOffset(lineOffsets: number[], offset: number): Position {
	let lo = 0;
	let hi = lineOffsets.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineOffsets[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return new Position(lo, offset - lineOffsets[lo]);
}
