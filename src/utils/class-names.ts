import { Position, Range } from "vscode";

import { type ClassTransformer, dashesCamelCase, toCamelCase } from "./index";

export interface CssClass {
	name: string;
	range: Range;
}

export function findCssClasses(content: string): CssClass[] {
	const classes: CssClass[] = [];
	const classRe = /\.([_A-Za-z-][_A-Za-z0-9-]*)/g;
	let match: RegExpExecArray | null = null;

	while ((match = classRe.exec(content)) !== null) {
		if (match.index > 0 && /[_A-Za-z0-9-]/.test(content[match.index - 1])) continue;

		const start = match.index + 1;
		classes.push({
			name: match[1],
			range: rangeForOffset(content, start, start + match[1].length)
		});
	}

	return classes;
}

export function findCssClassPosition(
	content: string,
	className: string,
	classTransformer: ClassTransformer | null
): Position | null {
	return (
		findCssClasses(content).find(cssClass => isClassNameMatch(cssClass.name, className, classTransformer))?.range
			.start || null
	);
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

function rangeForOffset(content: string, start: number, end: number): Range {
	return new Range(positionForOffset(content, start), positionForOffset(content, end));
}

function positionForOffset(content: string, offset: number): Position {
	const before = content.slice(0, offset);
	const lines = before.split(/\r\n|\r|\n/);
	return new Position(lines.length - 1, lines[lines.length - 1].length);
}
