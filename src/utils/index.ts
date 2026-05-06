import { type TextDocument, Position, CompletionItem, CompletionItemKind, TextEdit, Range } from "vscode";

import { getCssClassesFromFile } from "./class-names";

export function getCurrentLine(document: TextDocument, position: Position): string {
	return document.getText(document.lineAt(position).range);
}

export async function getAllClassNames(filePath: string, keyword: string): Promise<string[]> {
	const classes = await getCssClassesFromFile(filePath);
	const names = [...new Set(classes.map(c => c.name))];
	return keyword !== "" ? names.filter(name => name.includes(keyword)) : names;
}

export function isKebabCaseClassName(className: string): boolean {
	return className.includes("-");
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
