import { type Disposable, workspace } from "vscode";

import { EXT_NAME } from "./utils/constants";

type LegacyCamelCaseValues = false | true | "true" | "dashes";
export type ClassNameConvention = "asIs" | "camelCase" | "dashes";
export type AliasFromUserOptions = Record<string, string>;
export type AliasFromTsConfig = Record<string, string[]>;
export type PathAlias = AliasFromUserOptions | AliasFromTsConfig;

export interface ExtensionOptions {
	classNameExportConvention: ClassNameConvention;
	createCssModuleTargetFolder: string;
	debugPerformance: boolean;
	pathAlias: AliasFromUserOptions;
}

export type ExtensionOptionsProvider = ExtensionOptions | (() => ExtensionOptions);

export function resolveOptions(options: ExtensionOptionsProvider): ExtensionOptions {
	return typeof options === "function" ? options() : options;
}

let cachedOptions: ExtensionOptions | null = null;

export function readOptions(): ExtensionOptions {
	if (cachedOptions) {
		return cachedOptions;
	}

	const configuration = workspace.getConfiguration(EXT_NAME);
	cachedOptions = {
		classNameExportConvention: readClassNameExportConvention(),
		createCssModuleTargetFolder: configuration.get<string>("createCssModule.targetFolder", ""),
		debugPerformance: configuration.get<boolean>("debugPerformance", false),
		pathAlias: configuration.get<AliasFromUserOptions>("pathAlias", {})
	};

	return cachedOptions;
}

function readClassNameExportConvention(): ClassNameConvention {
	const configuration = workspace.getConfiguration(EXT_NAME);
	const convention = configuration.get<ClassNameConvention | undefined>("classNameExportConvention");
	if (convention) {
		return convention;
	}

	const legacyConvention = configuration.get<ClassNameConvention | undefined>("classNameConvention");
	if (legacyConvention) {
		return legacyConvention;
	}

	const legacyCamelCase = configuration.get<LegacyCamelCaseValues>("camelCase", false);
	if (legacyCamelCase === true || legacyCamelCase === "true") {
		return "camelCase";
	}

	if (legacyCamelCase === "dashes") {
		return "dashes";
	}

	return "asIs";
}

export function subscribeToConfigChanges(): Disposable {
	return workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(EXT_NAME)) {
			cachedOptions = null;
		}
	});
}
