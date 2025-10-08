import { App, Modal, Setting } from 'obsidian';
import HexoPublisherPlugin from '../main';

export class NewPostModal extends Modal {
	plugin: HexoPublisherPlugin;
	title: string;

	constructor(app: App, plugin: HexoPublisherPlugin) {
		super(app);
		this.plugin = plugin;
		this.title = '';
	}

	onOpen() {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: 'Create New Hexo Post' });
		
		const titleInput = new Setting(contentEl)
			.setName('Post Title')
			.setDesc('Enter the title for your new post')
			.addText(text => text
				.setPlaceholder('Enter post title')
				.setValue(this.title)
				.onChange(value => {
					this.title = value;
				})
			);
		
		// Focus on the input field when modal opens
		const titleInputElement = titleInput.controlEl.querySelector('input');
		if (titleInputElement) {
			titleInputElement.focus();
			
			// Add Enter key support
			titleInputElement.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					if (this.title.trim()) {
						this.plugin.createNewPost(this.title);
						this.close();
					}
				}
			});
		}

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					if (this.title.trim()) {
						this.plugin.createNewPost(this.title);
						this.close();
					}
				})
			)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}