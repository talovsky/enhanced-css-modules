# Enhanced CSS Modules

![Enhanced CSS Modules Logo](./icon/enhanced-css-modules.png)

Enhanced CSS Modules provides smart editor support for CSS Modules in VS Code —
autocomplete, go-to-definition, and rename/refactor support for class names.

Features

- Autocomplete class names from CSS Modules
- Go to definition for class names (jump to CSS file)
- Rename/Refactor class names across JS/TS and style files

Supported languages

- JavaScript / TypeScript (+ React variants)
- Astro
- CSS, SCSS, Sass, Less, Stylus (for rename support)

Installation

- Install from the VS Code Marketplace (search "Enhanced CSS Modules").
- From source (requires pnpm):

```bash
pnpm install
pnpm run compile
```

Usage

- Import a CSS module in your file and start typing class names to get suggestions.

Example

```javascript
import styles from "./sample.css";

const className = styles.container; // autocomplete and go-to-definition
```

- Use "Go to Definition" (F12 / Cmd+Click) on a class name to jump to its CSS rule.
- Rename class names to update usages across supported files.

Configuration

- `enhancedCssModules.camelCase` (boolean|string): Transform classnames in autocomplete suggestions. Default: `false`.
- `enhancedCssModules.pathAlias` (object): Map path aliases for import resolution. Example:

```json
"enhancedCssModules.pathAlias": { "@/": "src/" }
```

Rename behavior

- The extension shows and preserves the actual CSS selector names (for example
  `class-name--active`) when you perform a rename — even if you access the
  class in code using camelCase (for example `styles.classNameActive`).
- During a rename operation the editor displays and updates the pretty CSS
  class (kebab-case / BEM-style), and the corresponding JS/TS accessors are
  updated to remain valid. This keeps your source code ergonomic while
  preserving readable CSS in the stylesheet.

Example

```text
Before: styles.classNameActive  -> CSS: .class-name--active
After renaming to "is-active": CSS becomes .is-active and JS updates accordingly
```

Development

- Build: `pnpm run compile`
- Run tests: `pnpm test`
- Watch/build continuously: `pnpm run watch`
- Lint & format: `pnpm run lint`

Contributing

- Open issues or PRs — follow the existing code style and run tests before submitting.

License

- MIT — see the `LICENSE` file.

Acknowledgements

- This project is inspired by and builds on ideas from the CSS Modules ecosystem.
