import path from "node:path";

import { type CancellationToken, Location, type Position, type TextDocument, workspace } from "vscode";

import { findCssClasses, type CssClass } from "./utils/class-names";
import { findCssModuleImporters } from "./utils/css-module-importers";
import { measurePerformance } from "./utils/performance";
import { findUsageRangesForClassNames } from "./utils/usages";

export function createCSSModuleReferenceProvider() {
	return {
		async provideReferences(
			document: TextDocument,
			position: Position,
			_context: unknown,
			token: CancellationToken
		): Promise<Location[]> {
			return measurePerformance("references", async () => {
				if (!isCssModuleDocument(document)) {
					return [];
				}

				const target = getCssClassAtPosition(document, position);
				if (!target) {
					return [];
				}

				const locations: Location[] = [];
				const importers = await findCssModuleImporters(document.uri, token);

				for (const importer of importers) {
					if (token.isCancellationRequested) {
						return [];
					}

					const sourceDocument = await workspace.openTextDocument(importer.uri);
					for (const usage of findUsageRangesForClassNames(sourceDocument, importer.importName, [target.name])) {
						locations.push(new Location(sourceDocument.uri, usage.range));
					}
				}

				return locations;
			});
		}
	};
}

function getCssClassAtPosition(document: TextDocument, position: Position): CssClass | null {
	return findCssClasses(document.getText()).find(item => item.range.contains(position)) ?? null;
}

function isCssModuleDocument(document: TextDocument): boolean {
	return /\.module\.(?:css|scss|sass|less|styl|stylus)$/.test(path.basename(document.uri.fsPath));
}

export default createCSSModuleReferenceProvider;
