import { Plugin, MarkdownView } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './types';
import { FrontmatterSuggester } from './suggester';
import { FrontmatterSuggesterSettingTab } from './settings';
import { ValueValidatorExtension } from './value-validator-extension';

export default class FrontmatterSuggesterPlugin extends Plugin {
	settings: PluginSettings;
	suggester: FrontmatterSuggester | null = null;
	validator: ValueValidatorExtension | null = null;

	async onload() {

		await this.loadSettings();

		// Register the suggester
		this.suggester = new FrontmatterSuggester(this.app, this.settings);
		this.registerEditorSuggest(this.suggester);

		// Initialize validator
		this.validator = new ValueValidatorExtension(this.settings);

		// Register change event for validation
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, view) => {
				if (this.validator && view instanceof MarkdownView) {
					this.validator.validateWithDebounce(editor, view);
				}
			})
		);

		// Update suggester with loaded settings
		this.updateSuggester();

		// Add settings tab
		this.addSettingTab(new FrontmatterSuggesterSettingTab(this.app, this));
	}

	onunload() {
		this.validator?.cleanup();
		this.validator = null;
		this.suggester = null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateSuggester() {
		if (this.suggester) {
			this.suggester.updateSettings(this.settings);
		}
		if (this.validator) {
			this.validator.updateSettings(this.settings);
		}
	}
}
