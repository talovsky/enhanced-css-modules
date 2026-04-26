import path from "node:path";

import { type TextDocument, Position, type CancellationToken, Location, Uri } from "vscode";

import { type ExtensionOptionsProvider, resolveOptions } from "./options";
import { getRealPathAlias } from "./path-alias";
import { getClassTransformer, type ClassTransformer } from "./utils";
import { getCssClassesFromFile, isClassNameMatch } from "./utils/class-names";
import { resolveImportPath } from "./utils/path";
import { getCssModuleClickInfo } from "./utils/usages";

async function getTargetPosition(
	filePath: string,
	targetClass: string,
	classTransformer: ClassTransformer | null
): Promise<Position | null> {
	if (targetClass === "") {
		return new Position(0, 0);
	}

	const classes = await getCssClassesFromFile(filePath);
	return classes.find(c => isClassNameMatch(c.name, targetClass, classTransformer))?.range.start ?? null;
}

export function createCSSModuleDefinitionProvider(options: ExtensionOptionsProvider) {
	return {
		async provideDefinition(
			document: TextDocument,
			position: Position,
			_token: CancellationToken
		): Promise<Location | null> {
			const { camelCase: camelCaseConfig, pathAlias } = resolveOptions(options);
			const currentDir = path.dirname(document.uri.fsPath);
			const classTransformer = getClassTransformer(camelCaseConfig);

			const clickInfo = getCssModuleClickInfo(document, position);
			if (!clickInfo) {
				return null;
			}

			const importPath = await resolveImportPath(
				clickInfo.importModule,
				currentDir,
				await getRealPathAlias(pathAlias, document)
			);
			if (importPath === "") {
				return null;
			}

			const targetPosition = await getTargetPosition(importPath, clickInfo.targetClass, classTransformer);
			if (targetPosition === null) {
				return null;
			}

			return new Location(Uri.file(importPath), targetPosition);
		}
	};
}

export default createCSSModuleDefinitionProvider;
