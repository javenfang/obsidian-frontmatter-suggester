import { Plugin } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './types';
import { FrontmatterSuggester } from './suggester';
import { FrontmatterSuggesterSettingTab } from './settings';

export default class FrontmatterSuggesterPlugin extends Plugin {
	settings: PluginSettings;
	suggester: FrontmatterSuggester | null = null;

	async onload() {
	
		await this.loadSettings();

		// Register the suggester
		this.suggester = new FrontmatterSuggester(this.app, this.settings);
		this.registerEditorSuggest(this.suggester);

		// Update suggester with loaded settings
		this.updateSuggester();

		// Add settings tab
		this.addSettingTab(new FrontmatterSuggesterSettingTab(this.app, this));
	}

	onunload() {
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
	}
}
