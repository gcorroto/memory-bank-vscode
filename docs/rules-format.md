# Rules Format for MacGyver

## Introduction

MacGyver can use project-specific rules to customize its behavior and recommendations. These rules can be applied globally or to specific file types.

## Rules File Locations

Rules can be stored in one of the following locations:

1. `.cursor/rules` - Traditional rules file (no frontmatter)
2. `@rules.mdc` - Rules file with YAML frontmatter in the project root
3. `.cursor/rules.d/*.mdc` - Directory with multiple rule files with YAML frontmatter

## MDC Rules Format

MDC rules files use YAML frontmatter to specify metadata about when and how the rules should be applied:

```markdown
---
description: Description of what these rules are for
globs: **/*.js, **/*.ts
alwaysApply: false
---

# Actual Rules Content

Your rule content goes here...
```

### Frontmatter Fields

- `description`: A brief description of what these rules cover
- `globs`: Comma-separated list of glob patterns that define which files these rules apply to
- `alwaysApply`: Boolean flag (true/false) that determines if rules should apply to all files regardless of globs

### Glob Pattern Examples

- `**/*.js` - Match all JavaScript files in any directory
- `src/*.ts` - Match TypeScript files directly in the src directory
- `*.py` - Match Python files in the current directory
- `**/*` - Match all files (not recommended, use alwaysApply instead)

## How Rules Are Applied

1. If `.cursor/rules` exists, it's always applied (for backward compatibility)
2. Otherwise, MacGyver collects all applicable rules from `.mdc` files:
   - Rules with `alwaysApply: true` are always included
   - Rules with glob patterns are included only if they match the current file
3. All applicable rules are combined and added to the prompt

## Example

```markdown
---
description: Rules for JavaScript development
globs: **/*.js, **/*.jsx, **/*.ts, **/*.tsx
---

# JavaScript Best Practices

1. Use ESLint to enforce code quality
2. Follow AirBnB style guide
3. Prefer functional programming approaches
```

This would only apply to JavaScript and TypeScript files in the project.