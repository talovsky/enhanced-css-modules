import { type TextDocument, Position, type CancellationToken, Location, Uri } from "vscode";

import { type ExtensionOptionsProvider, resolveOptions } from "./options";
import { getCssClassesFromFile } from "./utils/class-names";
import { resolveCssModulePath } from "./utils/css-module-context";
import { measurePerformance } from "./utils/performance";
import { getCssModuleClickInfo } from "./utils/usages";

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
		): Promise<Location | null> {
			const { debugPerformance, pathAlias } = resolveOptions(options);
			return measurePerformance(
				"definition",
				async () => {
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
