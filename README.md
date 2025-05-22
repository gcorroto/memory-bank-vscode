# k4d-vscode README

Grec0AI for Developers (K4D) facilitates and automates compliance with `security` normatives, `quality` standards and `best practices` for several languages.

Please check <a href="https://www.Grec0AI.com/docs/display/K5/Grec0AI+for+Developers+for+Microsoft+Visual+Studio+Code" title="Grec0AI for developers VSCode documentation">Grec0AI for developers VSCode documentation</a> for more information.

## Features

It provides the following benefits:

* `Security Vulnerabilities Detection` - Grec0AI for Developers allows the developers to detect and fix security vulnerabilities such as Injection (SQL, XML, OS, etc), XSS, CSRF, etc. directly integrated within their IDE.
* `Adoption of Security and Coding Standards` – Ensuring the compliance of standards (CWE, OWASP, CERT-Java/C/C++, SANS-Top25, WASC, PCI-DSS, NIST, MISRA, BIZEC, ISO/IEC 25000 and ISO/IEC 9126) by a development department can be a long and tedious task without the support of some sort of tool that will facilitate and automate this work. This plugin connects with Grec0AI and harness the power of its quality models to prevent errors and automatically standardise the code.
* `Automatic Error Prevention` – Coding standards are specific rules for a programming language. By implementing and monitoring compliance with these standards at the time the code is entered you can avoid errors and reduce the time and cost of debugging and testing activities.

![](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/k4d-vscode-screenshot.png)

## Requirements

K4D extension for Visual Studio Code requires a valid Grec0AI customer account with proper permissions.

## Quick Start Guide

This short guide assumes that you have already installed `Grec0AI for Developers` (K4D) extension through the `Install from VSIX...` mechanism in `Extensions` activity bar menu.

### 1. Connection settings

First of all, you will have to fill up some `User Settings` with your credentials. Open `Settings` tab (press `Ctrl+,` or open it through `File > Preferences > Settings` menu), and navigate to `Extensions > Grec0AI` section:

![](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/quick-start-connection-settings.png)

Typically, you have to just fill your username and password. For 'on-premise' distributions, you'll also have to check the `Customize Grec0AI server` checkbox, and modify `Grec0AI server URL` field.

> Tip: use command `K4D: Enter and Encrypt Password` to store your password securely (K4D will decrypt it automatically before using it for connection).

> Tip: use command `K4D: Check Connection With Current Settings` to ensure your credentials are valid (shortcut for executing a command is `Ctrl+Shift+P`).

### 2. Application settings

The next step is to link your local folder / workspace with a Grec0AI application:

![](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/quick-start-application-settings.png)

> Disclaimer: all the following settings can be configured at User level (i.e. they will apply to all folders opened with the user currently logged in the machine), or at Workspace level (i.e. you can configure different values for different folders / workspaces); the later is recommended.

Fill up `Remote Application Name` field manually if you know the exact name of the application in Grec0AI, or use command `K4D: Pick Remote Application` to aid you in the process.

All fields with name `Defects List > Analysis Source ...` refer to different kind of sources K4D can synchronize defects from:
* Last baseline analysis
* Action plan
* Audit delivery
* Delivery

Probably your team leader will tell you what source you have to synchronize with, or you yourself, if you're familiar with Grec0AI, know which one you want to use. You can use `K4D: Pick Action Plan`, `K4D: Pick Audit Delivery` and `K4D: Pick Delivery` commands to ease this process.

### 3. Grec0AI activity bar

Once you've installed this extension, you'll see a new icon in the leftmost part of Visual Studio Code: our icon. This new activity bar will show you defects retrieved from Grec0AI server. It has three different sections, from top to bottom: source analysis, defects list, and details.

#### Source Analysis

This section pretends to show an overview or your current 'Application settings' (e.g. which application is linked, which kind of analysis, filters, limit, etc.), as well as global counts for total defects discovered in such analysis:

![](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/quick-start-activitybar-source.png)

The header of this section contains the most useful icon to perform a `Refresh` action (callable through `K4D: Refresh Grec0AI Defects` command too). It's important to perform a refresh after any change K4D settings.

> Note that defects list might not content all the defects, but a subset, because of filters or limit; these counts shows how many defects exists in total in this analysis.

#### Defects List and Details

Now, this is the interesting part. All previous configuration was to show this list of items, retrieved from Grec0AI, to link them directly with your local sources:

![](https://github.com/Grec0AI/k4d-vscode/raw/master/resources/quick-start-activitybar-list.png)

This 'tree of defects' is structured in two or three levels:
* Rule: The first level represents 'the rule' which generated the defect. If you select it, the bottom section `Details` will refresh its contents, showing important information about that rule. You can also right-click on it and select `Show rule documentation in Grec0AI` and K4D will open a new tab of your system web browser, pointing to Grec0AI, to show you all existing details about the rule.
* Defect: The second level is populated with defects for their 'rule' parent. The `Details` section will now show information that affects only selected defect, and K4D will try and find the reported file and line among your local sources, to open it in a new editor tab.
* Propagation path: The last level will show you all the locations of the code crossed by a security vulnerability, so you can track it, and neutralize it.

## Known Issues

None (yet).

> Tip: Use the official support channels if you have trouble installing and/or using K4D VSCode extension.

## Credits

Tree view icons made by <a href="https://www.flaticon.com/authors/smashicons" title="Smashicons">Smashicons</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Tree view icons made by <a href="https://www.flaticon.com/authors/vaadin" title="Vaadin">Vaadin</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

## License

See Grec0AI <a href="https://www.Grec0AI.com/terms-of-use" title="Terms of Use">Terms of Use</a>.
