import { type ExtensionOptions } from "../options";

export function readOptions(overrides: Partial<ExtensionOptions> = {}): ExtensionOptions {
	return {
		camelCase: false,
		createCssModuleTargetFolder: "",
		debugPerformance: false,
		pathAlias: {},
		...overrides
	};
}
