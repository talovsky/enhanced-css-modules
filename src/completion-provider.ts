import path from "node:path";

import { type TextDocument, type Position, CompletionItem, CompletionItemKind } from "vscode";

import { type ExtensionOptionsProvider, readOptions, resolveOptions } from "./options";
import { getRealPathAlias } from "./path-alias";
import {
	getAllClassNames,
	getCurrentLine,
	getClassTransformer,
	isKebabCaseClassName,
	createBracketCompletionItem
} from "./utils";
import { findImportModule, resolveImportPath } from "./utils/path";

// check if current character or last character is .
// or if current character is " or ' after a [
function isTrigger(line: string, position: Position): boolean {
	const i = position.character - 1;
	const isDotSyntax = line[i] === "." || (i > 1 && line[i - 1] === ".");
	if (isDotSyntax) {
		return true;
	}

	const isBracketSyntax = line[i - 1] === "[" && (line[i] === '"' || line[i] === "'");
	if (isBracketSyntax) {
		return true;
	}

	return false;
}

function getWords(line: string, position: Position): string {
	const text = line.slice(0, position.character);
	// support optional chain https://github.com/tc39/proposal-optional-chaining
	// covert ?. to .
	const convertText = text.replace(/(\?\.)/g, ".");
	const index = convertText.search(/[a-zA-Z0-9._["']*$/);
	if (index === -1) {
		return "";
	}

	return convertText.slice(index);
}

export function createCSSModuleCompletionProvider(options: ExtensionOptionsProvider = readOptions) {
	return {
		async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[]> {
			const currentOptions = resolveOptions(options);
			const classTransformer = getClassTransformer(currentOptions.camelCase);
			const pathAliasOptions = currentOptions.pathAlias;
			const currentLine = getCurrentLine(document, position);
			const currentDir = path.dirname(document.uri.fsPath);

			if (!isTrigger(currentLine, position)) {
				return [];
			}

			const splitRegex = /\.|\["|\['/;
			const words = getWords(currentLine, position);
			if (words === "" || !splitRegex.test(words)) {
				return [];
			}

			const [obj, field] = words.split(splitRegex);

			const importModule = findImportModule(document.getText(), obj);
			const importPath = await resolveImportPath(
				importModule,
				currentDir,
				await getRealPathAlias(pathAliasOptions, document)
			);
			if (importPath === "") {
				return [];
			}

			const classNames = await getAllClassNames(importPath, field);

			return classNames.map(_class => {
				const name = classTransformer ? classTransformer(_class) : _class;
				return isKebabCaseClassName(name)
					? createBracketCompletionItem(name, position, currentLine)
					: new CompletionItem(name, CompletionItemKind.Variable);
			});
		}
	};
}

export default createCSSModuleCompletionProvider;
