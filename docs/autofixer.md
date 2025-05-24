# AutoFixer Feature Documentation

## Overview

The **AutoFixer** feature provides automated execution of instructions from a special file named `autofixer.md` in your project root. It's designed for CI/CD workflows, Cloud IDE environments, and automated deployments where you need to perform code fixes, refactors, or setup tasks without manual intervention.

## How to Enable AutoFixer

There are two ways to enable the AutoFixer feature:

1. **Extension Configuration**:
   - Set `grec0ai.autofixer.enabled` to `true` in your VSCode settings

2. **Environment Variable**:
   - Set `GREC0AI_AUTOFIXER=1` in your environment

## How It Works

When enabled:

1. The extension checks for an `autofixer.md` file in your workspace root directory
2. If found, the contents are read and processed by the Grec0AI agent
3. The agent executes the instructions as if they were entered by a user
4. Results and logs are available in the Grec0AI output panel

## Creating an autofixer.md File

The `autofixer.md` file should be written in Markdown format and contain natural language instructions for the agent. For example:

```markdown
# Automatic Code Fixes

Please perform the following tasks:

1. Fix the error in the function `calculateTotal()` in `src/utils/calculator.js` 
2. Add proper error handling to the API calls in `src/services/api.js`
3. Increase test coverage for the `UserService` component to at least 80%
```

## Use Cases

- **Automated environment setup**: Fix common issues when new developers clone the repository
- **CI/CD pipelines**: Generate or update code as part of automated workflows
- **Containerized environments**: Apply fixes when deploying to containerized VSCode environments like Code Server

## Notes

- The AutoFixer is disabled by default for security reasons
- No confirmation prompts are shown when AutoFixer is running
- If the `autofixer.md` file is not found, the extension will continue normal operation without errors
- All actions performed by AutoFixer are logged to the Grec0AI output channel