import type { ExtensionOptions } from "../options";

export function readOptions(overrides: Partial<ExtensionOptions> = {}): ExtensionOptions {
	return {
		classNameExportConvention: "asIs",
		createCssModuleTargetFolder: "",
		debugPerformance: false,
		pathAlias: {},
		...overrides
	};
}
