import { type TextDocument, type Position, type CancellationToken, CompletionItem, CompletionItemKind } from "vscode";

import { type ExtensionOptionsProvider, readOptions, resolveOptions } from "./options";
import { getAllClassNames, getCurrentLine, isKebabCaseClassName, createBracketCompletionItem } from "./utils";
import { resolveCssModuleImport } from "./utils/css-module-context";
import { measurePerformance } from "./utils/performance";

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
			return measurePerformance(
				"completion",
				async () => {
					const currentLine = getCurrentLine(document, position);

					const splitRegex = /\.|\["|\['/;
					const words = getWords(currentLine, position);
					if (words === "" || !splitRegex.test(words)) {
						return [];
					}

					const segments = words.split(splitRegex);
					const [obj] = segments;
					const field = segments.at(-1) || "";

					const cssModule = await resolveCssModuleImport(document, obj, currentOptions.pathAlias, token);
					if (!cssModule) {
						return [];
					}

					const classNames = await getAllClassNames(cssModule.importPath, field);
					if (token?.isCancellationRequested) {
						return [];
					}

					return classNames.map(name =>
						isKebabCaseClassName(name)
							? createBracketCompletionItem(name, position, currentLine)
							: new CompletionItem(name, CompletionItemKind.Variable)
					);
				},
				currentOptions.debugPerformance
			);
		}
	};
}

export default createCSSModuleCompletionProvider;
