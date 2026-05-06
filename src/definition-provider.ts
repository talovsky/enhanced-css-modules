import { type TextDocument, Position, type CancellationToken, Location, Uri, workspace } from "vscode";

import { type ExtensionOptionsProvider, resolveOptions } from "./options";
import { getCssClassesFromFile } from "./utils/class-names";
import { resolveCssModulePath } from "./utils/css-module-context";
import { findCssModuleImporters } from "./utils/css-module-importers";
import { getCssClassAtPosition, isCssModuleDocument } from "./utils/css-module-usages";
import { measurePerformance } from "./utils/performance";
import { findUsageRangesForClassNames, getCssModuleClickInfo } from "./utils/usages";

const neverCancelledToken = { isCancellationRequested: false } as CancellationToken;

async function getTargetPosition(filePath: string, targetClass: string): Promise<Position | null> {
	if (targetClass === "") {
		return new Position(0, 0);
	}

	const classes = await getCssClassesFromFile(filePath);
	return classes.find(c => c.name === targetClass)?.range.start ?? null;
}

export function createCSSModuleDefinitionProvider(options: ExtensionOptionsProvider) {
	return {
		async provideDefinition(
			document: TextDocument,
			position: Position,
			token?: CancellationToken
		): Promise<Location | Location[] | null> {
			const { debugPerformance, pathAlias } = resolveOptions(options);
			return measurePerformance(
				"definition",
				async () => {
					if (isCssModuleDocument(document)) {
						const cssClass = getCssClassAtPosition(document, position);
						if (!cssClass) {
							return null;
						}

						const cancellationToken = token ?? neverCancelledToken;
						const locations: Location[] = [];
						const importers = await findCssModuleImporters(document.uri, cancellationToken);
						for (const importer of importers) {
							if (cancellationToken.isCancellationRequested) break;
							const sourceDoc = await workspace.openTextDocument(importer.uri);
							for (const usage of findUsageRangesForClassNames(sourceDoc, importer.importName, [cssClass.name])) {
								locations.push(new Location(sourceDoc.uri, usage.range));
							}
						}
						return locations.length > 0 ? locations : new Location(document.uri, cssClass.range);
					}

					const clickInfo = getCssModuleClickInfo(document, position);
					if (!clickInfo) {
						return null;
					}

					const importPath = await resolveCssModulePath(document, clickInfo.importModule, pathAlias, token);
					if (importPath === null) {
						return null;
					}

					const targetPosition = await getTargetPosition(importPath, clickInfo.targetClass);
					if (targetPosition === null || token?.isCancellationRequested) {
						return null;
					}

					return new Location(Uri.file(importPath), targetPosition);
				},
				debugPerformance
			);
		}
	};
}

export default createCSSModuleDefinitionProvider;
