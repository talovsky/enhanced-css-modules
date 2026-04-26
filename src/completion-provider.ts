import path from "node:path";

import { type TextDocument, type Position, type CancellationToken, CompletionItem, CompletionItemKind } from "vscode";

import { type ExtensionOptionsProvider, readOptions, resolveOptions } from "./options";
import { getRealPathAlias } from "./path-alias";
import {
	getAllClassNames,
	getCurrentLine,
	getClassTransformer,
	isKebabCaseClassName,
	createBracketCompletionItem
} from "./utils";
import { findImportModuleInDocument, resolveImportPath } from "./utils/path";

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
		async provideCompletionItems(
			document: TextDocument,
			position: Position,
			token?: CancellationToken
		): Promise<CompletionItem[]> {
			const currentOptions = resolveOptions(options);
			const classTransformer = getClassTransformer(currentOptions.camelCase);
			const pathAliasOptions = currentOptions.pathAlias;
			const currentLine = getCurrentLine(document, position);
			const currentDir = path.dirname(document.uri.fsPath);

			const splitRegex = /\.|\["|\['/;
			const words = getWords(currentLine, position);
			if (words === "" || !splitRegex.test(words)) {
				return [];
			}

			const segments = words.split(splitRegex);
			const [obj] = segments;
			const field = segments.at(-1) || "";

			const importModule = findImportModuleInDocument(document, obj);
			if (importModule === "") {
				return [];
			}

			const realPathAlias = await getRealPathAlias(pathAliasOptions, document);
			if (token?.isCancellationRequested) {
				return [];
			}

			const importPath = await resolveImportPath(importModule, currentDir, realPathAlias);
			if (importPath === "" || token?.isCancellationRequested) {
				return [];
			}

			const classNames = await getAllClassNames(importPath, field, classTransformer);
			if (token?.isCancellationRequested) {
				return [];
			}

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
