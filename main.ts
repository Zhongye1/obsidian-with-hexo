import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, ItemView, WorkspaceLeaf } from 'obsidian';
import { exec, ChildProcess } from 'child_process';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	hexoSourcePath: string; // Add hexo source path setting
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	hexoSourcePath: '' // Default empty path
}

const VIEW_TYPE_COMMAND_PROGRESS = "command-progress-view";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private progressView: CommandProgressView | null = null;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Add a new ribbon icon to execute folder location command
		const echoRibbonIconEl = this.addRibbonIcon('terminal', 'Show Hexo Folder Location', (_evt: MouseEvent) => {
			this.executePathCommand();
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

		// Register the progress view
		this.registerView(
			VIEW_TYPE_COMMAND_PROGRESS,
			(leaf) => new CommandProgressView(leaf)
		);

		// Add command to open progress panel
		this.addCommand({
			id: 'open-command-progress-panel',
			name: 'Open command progress panel',
			callback: async () => {
				await this.openProgressPanel();
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

		// Add command to open folder selection dialog
		this.addCommand({
			id: 'select-hexo-source-folder',
			name: 'Select Hexo source folder',
			callback: () => {
				this.selectFolderCommand();
			}
		});

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
		exec('echo "十堰，北戴河，共青城，秋明，ASN-08217-DAT-3826"', (error, stdout, stderr) => {
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
	private async executePathCommand() {
		if (!this.settings.hexoSourcePath) {
			new Notice('Please set Hexo source path in plugin settings');
			return;
		}

		// Open the progress panel
		await this.openProgressPanel();

		// Get the progress view
		const progressView = this.getProgressView();
		if (!progressView) return;

		// First, display the current path
		progressView.updateProgress(`Current path: ${this.settings.hexoSourcePath}\nStarting command execution...`);

		// Execute hexo s command in the specified path after 2 seconds delay
		setTimeout(() => {
			progressView.setRunning(true);

			const command = `cd /d "${this.settings.hexoSourcePath}" && hexo cl && hexo g && hexo d`;
			const childProcess: ChildProcess = exec(command, (error, stdout, stderr) => {
				if (!progressView.getRunning()) return;

				if (error) {
					progressView.updateProgress(`${progressView.getProgressText()}\nError: ${error.message}`);
					return;
				}
				if (stderr) {
					progressView.updateProgress(`${progressView.getProgressText()}\nStderr: ${stderr}`);
					return;
				}
				// Display command output
				progressView.updateProgress(`${progressView.getProgressText()}\nCommand execution completed: ${stdout.trim()}`);
				progressView.setRunning(false);
			});

			// Capture real-time output
			childProcess.stdout?.on('data', (data) => {
				if (!progressView.getRunning()) return;
				progressView.updateProgress(`${progressView.getProgressText()}${data}`);
			});

			childProcess.stderr?.on('data', (data) => {
				if (!progressView.getRunning()) return;
				progressView.updateProgress(`${progressView.getProgressText()}[ERROR] ${data}`);
			});
		}, 500);
	}

	// Command to trigger folder selection
	private async selectFolderCommand(): Promise<string | null> {
		// Create a temporary input element to select folder
		const input = document.createElement("input");
		input.type = "file";
		input.webkitdirectory = true;

		const pathPromise = new Promise<string | null>((resolve) => {
			input.onchange = () => {
				if (input.files && input.files.length > 0) {
					// For Windows, we need to get the directory path
					const path = input.files[0].path || '';
					if (path) {
						// Extract directory path from file path
						const pathParts = path.split('\\');
						const directoryPath = pathParts.slice(0, -1).join('\\');
						resolve(directoryPath);
					} else {
						resolve(null);
					}
				} else {
					resolve(null);
				}
			};

			input.oncancel = () => resolve(null);
		});

		input.click();

		const selectedPath = await pathPromise;
		return selectedPath;
	}

	// Open the progress panel
	private async openProgressPanel() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_COMMAND_PROGRESS);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_COMMAND_PROGRESS,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMAND_PROGRESS)[0]
		);
	}

	// Get the progress view
	private getProgressView(): CommandProgressView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMAND_PROGRESS);
		if (leaves.length === 0) {
			return null;
		}
		return leaves[0].view as CommandProgressView;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// View for command progress in the right panel
class CommandProgressView extends ItemView {
	private progressText: HTMLElement;
	private isRunning: boolean = false;
	private progressContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_COMMAND_PROGRESS;
	}

	getDisplayText() {
		return "Command Progress";
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('command-progress-view');
		container.createEl("style", {
			text: `
            .command-progress-view {
                background-color: #1e1e1e;
                color: #d4d4d4;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.4;
            }
            .command-progress-header {
                background-color: #252526;
                padding: 8px 12px;
                border-bottom: 1px solid #3c3c3c;
            }
            .command-progress-header h4 {
                margin: 0;
                color: #ffffff;
                font-weight: 500;
            }
            .command-progress-container {
                padding: 12px;
                height: calc(100% - 120px);
                overflow-y: auto;
                background-color: #1e1e1e;
            }
            .command-progress-text {
                white-space: pre-wrap;
                word-break: break-word;
            }
            .command-progress-buttons {
                padding: 12px;
                display: flex;
                gap: 8px;
                border-top: 1px solid #3c3c3c;
            }
            .command-progress-buttons button {
                background-color: #3c3c3c;
                color: #ffffff;
                border: none;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 2px;
            }
            .command-progress-buttons button:hover {
                background-color: #454545;
            }
            /* ANSI 颜色代码支持 */
            .ansi-black { color: #000000; }
            .ansi-red { color: #cd3131; }
            .ansi-green { color: #0dbc79; }
            .ansi-yellow { color: #e5e510; }
            .ansi-blue { color: #2472c8; }
            .ansi-magenta { color: #bc3fbc; }
            .ansi-cyan { color: #11a8cd; }
            .ansi-white { color: #e5e5e5; }
            .ansi-bright-black { color: #666666; }
            .ansi-bright-red { color: #f14c4c; }
            .ansi-bright-green { color: #23d18b; }
            .ansi-bright-yellow { color: #f5f543; }
            .ansi-bright-blue { color: #3b8eea; }
            .ansi-bright-magenta { color: #d670d6; }
            .ansi-bright-cyan { color: #29b8db; }
            .ansi-bright-white { color: #ffffff; }
            .ansi-bold { font-weight: bold; }
            .ansi-underline { text-decoration: underline; }
            .ansi-bg-black { background-color: #000000; }
            .ansi-bg-red { background-color: #cd3131; }
            .ansi-bg-green { background-color: #0dbc79; }
            .ansi-bg-yellow { background-color: #e5e510; }
            .ansi-bg-blue { background-color: #2472c8; }
            .ansi-bg-magenta { background-color: #bc3fbc; }
            .ansi-bg-cyan { background-color: #11a8cd; }
            .ansi-bg-white { background-color: #e5e5e5; }
            .ansi-bg-bright-black { background-color: #666666; }
            .ansi-bg-bright-red { background-color: #f14c4c; }
            .ansi-bg-bright-green { background-color: #23d18b; }
            .ansi-bg-bright-yellow { background-color: #f5f543; }
            .ansi-bg-bright-blue { background-color: #3b8eea; }
            .ansi-bg-bright-magenta { background-color: #d670d6; }
            .ansi-bg-bright-cyan { background-color: #29b8db; }
            .ansi-bg-bright-white { background-color: #ffffff; }
        `
		});

		// 创建头部
		const header = container.createEl("div", { cls: "command-progress-header" });
		header.createEl("h4", { text: "Command Execution Progress" });

		// 创建进度容器
		this.progressContainer = container.createEl("div", { cls: "command-progress-container" });
		this.progressText = this.progressContainer.createEl("div", {
			cls: "command-progress-text",
			text: "Ready to execute commands..."
		});

		// 创建按钮容器
		const buttonsContainer = container.createEl("div", { cls: "command-progress-buttons" });

		// 清除按钮
		const clearButton = buttonsContainer.createEl("button", { text: "Clear" });
		clearButton.onclick = () => {
			this.clearProgress();
		};

		// 取消按钮
		const cancelButton = buttonsContainer.createEl("button", { text: "Cancel" });
		cancelButton.onclick = () => {
			this.isRunning = false;
			this.updateProgress(`${this.getProgressText()}\nExecution cancelled by user.`);
		};
	}

	async onClose() {
		// Nothing to clean up
	}

	private parseAnsiEscapeCodes(text: string): string {
		const ansiColorMap: Record<number, string> = {
			30: 'ansi-black',
			31: 'ansi-red',
			32: 'ansi-green',
			33: 'ansi-yellow',
			34: 'ansi-blue',
			35: 'ansi-magenta',
			36: 'ansi-cyan',
			37: 'ansi-white',
			90: 'ansi-bright-black',
			91: 'ansi-bright-red',
			92: 'ansi-bright-green',
			93: 'ansi-bright-yellow',
			94: 'ansi-bright-blue',
			95: 'ansi-bright-magenta',
			96: 'ansi-bright-cyan',
			97: 'ansi-bright-white'
		};

		const ansiBgColorMap: Record<number, string> = {
			40: 'ansi-bg-black',
			41: 'ansi-bg-red',
			42: 'ansi-bg-green',
			43: 'ansi-bg-yellow',
			44: 'ansi-bg-blue',
			45: 'ansi-bg-magenta',
			46: 'ansi-bg-cyan',
			47: 'ansi-bg-white',
			100: 'ansi-bg-bright-black',
			101: 'ansi-bg-bright-red',
			102: 'ansi-bg-bright-green',
			103: 'ansi-bg-bright-yellow',
			104: 'ansi-bg-bright-blue',
			105: 'ansi-bg-bright-magenta',
			106: 'ansi-bg-bright-cyan',
			107: 'ansi-bg-bright-white'
		};

		let result = text;
		let openSpan = false;
		let currentClasses: string[] = [];

		result = result.replace(/\x1b\[([0-9;]*)m/g, (match, p1) => {
			const codes = p1 ? p1.split(';').map(Number) : [0];
			let styleClasses: string[] = [...currentClasses];
			let changed = false;

			for (const code of codes) {
				if (code === 0) { // reset
					const closeTag = openSpan ? '</span>' : '';
					openSpan = false;
					currentClasses = [];
					return closeTag;
				}

				if (ansiColorMap[code]) {
					styleClasses = styleClasses.filter(cls => !cls.startsWith('ansi-') || cls.includes('-bg-'));
					styleClasses.push(ansiColorMap[code]);
					changed = true;
				}

				if (ansiBgColorMap[code]) {
					styleClasses = styleClasses.filter(cls => !cls.includes('-bg-'));
					styleClasses.push(ansiBgColorMap[code]);
					changed = true;
				}

				if (code === 1) {
					if (!styleClasses.includes('ansi-bold')) {
						styleClasses.push('ansi-bold');
						changed = true;
					}
				}

				if (code === 4) {
					if (!styleClasses.includes('ansi-underline')) {
						styleClasses.push('ansi-underline');
						changed = true;
					}
				}
			}

			if (changed) {
				const closeTag = openSpan ? '</span>' : '';
				openSpan = true;
				currentClasses = styleClasses;
				return `${closeTag}<span class="${styleClasses.join(' ')}">`;
			}

			// 对于未识别的 ANSI 代码，返回空字符串以过滤掉它们
			return '';
		});

		if (openSpan) {
			result += '</span>';
		}

		return result.replace(/\n/g, '<br>');
	}


	// 更新 updateProgress 方法
	updateProgress(text: string) {
		if (this.progressText) {
			const formattedText = this.parseAnsiEscapeCodes(text);
			this.progressText.innerHTML = formattedText;

			// 自动滚动到底部
			this.progressContainer.scrollTop = this.progressContainer.scrollHeight;
		}
	}

	getProgressText(): string {
		return this.progressText ? this.progressText.innerHTML || "" : "";
	}

	setRunning(running: boolean) {
		this.isRunning = running;
	}

	getRunning() {
		return this.isRunning;
	}

	// 在 CommandProgressView 类中替换 clearProgress 方法
	clearProgress() {
		if (this.progressText) {
			this.progressText.innerHTML = "Ready to execute commands...";
		}
		this.isRunning = false;
	}

}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();


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
				.setButtonText("Select folder")
				.onClick(async () => {
					const selectedPath = await this.plugin.selectFolderCommand();
					if (selectedPath) {
						this.plugin.settings.hexoSourcePath = selectedPath;
						await this.plugin.saveSettings();
						// Refresh the settings display to show the new path
						this.display();
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
