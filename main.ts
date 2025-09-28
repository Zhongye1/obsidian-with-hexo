import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { exec } from 'child_process';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	hexoSourcePath: string; // Add hexo source path setting
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	hexoSourcePath: '' // Default empty path
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Add a new ribbon icon to execute echo command
		const echoRibbonIconEl = this.addRibbonIcon('terminal', 'Execute Echo Command', (_evt: MouseEvent) => {
			this.executeEchoCommand();
		});
		echoRibbonIconEl.addClass('echo-command-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		
		// Add command to execute echo "hello" command
		this.addCommand({
			id: 'execute-echo-command',
			name: 'Execute echo "hello" command',
			callback: () => {
				this.executeEchoCommand();
			}
		});
		
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	
	// Method to execute echo command and display result
	private executeEchoCommand() {
		exec('echo "hello"', (error, stdout, stderr) => {
			if (error) {
				new Notice(`Error: ${error.message}`);
				return;
			}
			if (stderr) {
				new Notice(`Stderr: ${stderr}`);
				return;
			}
			// Display command output
			new Notice(`Output: ${stdout.trim()}`);
		});
	}

	// Method to execute path command in hexo source directory
	private executePathCommand() {
		if (!this.settings.hexoSourcePath) {
			new Notice('Please set Hexo source path in plugin settings');
			return;
		}

		// Execute cd command to navigate to path and pwd to show current path
		exec(`cd "${this.settings.hexoSourcePath}" && cd`, (error, stdout, stderr) => {
			if (error) {
				new Notice(`Error: ${error.message}`);
				return;
			}
			if (stderr) {
				new Notice(`Stderr: ${stderr}`);
				return;
			}
			// Display current path
			new Notice(`Current path: ${stdout.trim()}`);
		});
	}

	// Method to select folder using system dialog
	async selectFolder(): Promise<string|null> {
		try {
			// Create a temporary input element to select folder
			const input = document.createElement("input");
			input.type = "file";
			input.webkitdirectory = true;
			input.style.display = "none";
			
			const pathPromise = new Promise<string|null>((resolve) => {
				input.onchange = () => {
					if (input.files && input.files.length > 0) {
						// Get the directory path (not file path)
						const fullPath = input.files[0].webkitRelativePath;
						const directoryPath = fullPath.split("/").slice(0, -1).join("/");
						resolve(directoryPath);
					} else {
						resolve(null);
					}
				};
				
				input.oncancel = () => resolve(null);
			});
			
			document.body.appendChild(input);
			input.click();
			document.body.removeChild(input);
			
			return await pathPromise;
		} catch (error) {
			new Notice(`Error selecting folder: ${error.message}`);
			return null;
		}
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hexo Source Path')
			.setDesc('Select the path to your Hexo source folder')
			.addText(text => text
				.setPlaceholder('Enter path to Hexo source folder')
				.setValue(this.plugin.settings.hexoSourcePath)
				.onChange(async (value) => {
					this.plugin.settings.hexoSourcePath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText("Browse")
				.onClick(async () => {
					const selectedPath = await this.plugin.selectFolder();
					if (selectedPath) {
						this.plugin.settings.hexoSourcePath = selectedPath;
						await this.plugin.saveSettings();
						this.display(); // Refresh the settings display
					}
				}));

		new Setting(containerEl)
			.setName('Execute Path Command')
			.setDesc('Run command in the specified Hexo source path')
			.addButton(button => button
				.setButtonText("Execute")
				.onClick(() => {
					this.plugin.executePathCommand();
				}));
	}
}
