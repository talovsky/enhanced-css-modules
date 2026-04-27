import path from "node:path";

import { type CancellationToken, Location, type Position, type TextDocument, workspace } from "vscode";

import { findCssClasses, type CssClass } from "./class-names";
import { findCssModuleImporters } from "./css-module-importers";
import { findUsageRangesForClassNames } from "./usages";

export function getCssClassAtPosition(document: TextDocument, position: Position): CssClass | null {
	return findCssClasses(document.getText()).find(item => item.range.contains(position)) ?? null;
}

export async function findSourceUsageLocationsForCssClass(
	document: TextDocument,
	className: string,
	token: CancellationToken
): Promise<Location[]> {
	const locations: Location[] = [];
	const importers = await findCssModuleImporters(document.uri, token);

	for (const importer of importers) {
		if (token.isCancellationRequested) {
			return [];
		}

		const sourceDocument = await workspace.openTextDocument(importer.uri);
		for (const usage of findUsageRangesForClassNames(sourceDocument, importer.importName, [className])) {
			locations.push(new Location(sourceDocument.uri, usage.range));
		}
	}

	return locations;
}

export function isCssModuleDocument(document: TextDocument): boolean {
	return /\.module\.(?:css|scss|sass|less|styl|stylus)$/.test(path.basename(document.uri.fsPath));
}
