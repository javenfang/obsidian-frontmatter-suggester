import { App, PluginSettingTab, Setting } from 'obsidian';
import FrontmatterSuggesterPlugin from './main';
import { FieldRule } from './types';
import { RuleEditorModal } from './rule-editor-modal';

export class FrontmatterSuggesterSettingTab extends PluginSettingTab {
	plugin: FrontmatterSuggesterPlugin;

	constructor(app: App, plugin: FrontmatterSuggesterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Frontmatter Suggester' });

		// Global Settings
		this.renderGlobalSettings(containerEl);

		// Field Rules
		this.renderFieldRules(containerEl);
	}

	private renderGlobalSettings(container: HTMLElement): void {
		container.createEl('h3', { text: 'Global Settings' });

		new Setting(container)
			.setName('Minimum match length')
			.setDesc('Minimum characters to type before showing suggestions (0 = show immediately)')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'0': '0 (immediate)',
					'1': '1',
					'2': '2',
					'3': '3'
				})
				.setValue(String(this.plugin.settings.globalSettings.minMatchLength))
				.onChange(async (value) => {
					this.plugin.settings.globalSettings.minMatchLength = Number(value);
					await this.plugin.saveSettings();
				})
			);

		new Setting(container)
			.setName('Maximum suggestions')
			.setDesc('Maximum number of suggestions to display')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.plugin.settings.globalSettings.maxSuggestions))
				.onChange(async (value) => {
					const num = Number(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.globalSettings.maxSuggestions = num;
						await this.plugin.saveSettings();
					}
				})
			);

		new Setting(container)
			.setName('Case sensitive')
			.setDesc('Match suggestions case-sensitively')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.globalSettings.caseSensitive)
				.onChange(async (value) => {
					this.plugin.settings.globalSettings.caseSensitive = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(container)
			.setName('Auto calculate indent')
			.setDesc('Automatically calculate indent based on property depth')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.globalSettings.autoIndent)
				.onChange(async (value) => {
					this.plugin.settings.globalSettings.autoIndent = value;
					await this.plugin.saveSettings();
				})
			);
	}

	private renderFieldRules(container: HTMLElement): void {
		container.createEl('h3', { text: 'Property Rules' });

		// Add New Rule button
		new Setting(container)
			.addButton(button => button
				.setButtonText('+ Add New Rule')
				.setCta()
				.onClick(async () => {
					const newRule: FieldRule = {
						id: this.generateId(),
						enabled: true,
						parentField: '',
						childField: '',
						sourceType: 'inline',
						options: [],
						displayFormat: {
							showDescription: true,
							showIcon: true
						},
						description: ''
					};
					this.plugin.settings.rules.push(newRule);
					await this.plugin.saveSettings();
					this.plugin.updateSuggester();

					// Open editor modal for the new rule
					const modal = new RuleEditorModal(
						this.app,
						this.plugin,
						newRule,
						this.plugin.settings.rules.length - 1,
						async (updatedRule) => {
							Object.assign(newRule, updatedRule);
							await this.plugin.saveSettings();
							this.plugin.updateSuggester();
							this.display();
						}
					);
					modal.open();
				})
			);

		// Render rules as simple list
		this.plugin.settings.rules.forEach((rule, index) => {
			this.renderRuleListItem(container, rule, index);
		});
	}

	private renderRuleListItem(container: HTMLElement, rule: FieldRule, index: number): void {
		const ruleItem = container.createDiv({ cls: 'frontmatter-rule-list-item' });
		ruleItem.style.display = 'flex';
		ruleItem.style.alignItems = 'center';
		ruleItem.style.gap = '10px';
		ruleItem.style.padding = '10px';
		ruleItem.style.borderBottom = '1px solid var(--divider-color)';

		// Enable/Disable toggle
		const toggleContainer = ruleItem.createDiv();
		new Setting(toggleContainer)
			.addToggle(toggle => toggle
				.setValue(rule.enabled)
				.onChange(async (value) => {
					rule.enabled = value;
					await this.plugin.saveSettings();
					this.plugin.updateSuggester();
				})
			);

		// Rule info
		const infoContainer = ruleItem.createDiv({ cls: 'frontmatter-rule-info' });
		infoContainer.style.flex = '1';

		const displayPath = rule.fieldPath || rule.parentField || '(not set)';
		const titleDiv = infoContainer.createDiv();
		titleDiv.createEl('strong', { text: `Rule ${index + 1}: ${displayPath}` });

		if (rule.description) {
			const descDiv = infoContainer.createDiv();
			descDiv.setText(rule.description);
			descDiv.style.fontSize = '0.9em';
			descDiv.style.color = 'var(--text-muted)';
		}

		// Action buttons
		const buttonsContainer = ruleItem.createDiv({ cls: 'frontmatter-rule-buttons' });
		buttonsContainer.style.display = 'flex';
		buttonsContainer.style.gap = '5px';

		// Edit button
		const editButton = buttonsContainer.createEl('button', { text: 'Edit' });
		editButton.style.padding = '5px 10px';
		editButton.onclick = () => {
			const modal = new RuleEditorModal(
				this.app,
				this.plugin,
				JSON.parse(JSON.stringify(rule)), // Deep copy
				index,
				async (updatedRule) => {
					Object.assign(rule, updatedRule);
					await this.plugin.saveSettings();
					this.plugin.updateSuggester();
					this.display();
				}
			);
			modal.open();
		};

		// Delete button
		const deleteButton = buttonsContainer.createEl('button', { text: 'Delete' });
		deleteButton.style.padding = '5px 10px';
		deleteButton.style.color = 'var(--text-error)';
		deleteButton.onclick = async () => {
			this.plugin.settings.rules.splice(index, 1);
			await this.plugin.saveSettings();
			this.plugin.updateSuggester();
			this.display();
		};
	}

	private generateId(): string {
		return 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
	}
}
