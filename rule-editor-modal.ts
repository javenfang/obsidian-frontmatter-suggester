import { App, Modal, Setting } from 'obsidian';
import { FieldRule, OptionItem } from './types';
import FrontmatterSuggesterPlugin from './main';

export class RuleEditorModal extends Modal {
	private plugin: FrontmatterSuggesterPlugin;
	private rule: FieldRule;
	private ruleIndex: number;
	private onSave: (rule: FieldRule) => Promise<void>;

	constructor(app: App, plugin: FrontmatterSuggesterPlugin, rule: FieldRule, ruleIndex: number, onSave: (rule: FieldRule) => Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.rule = rule;
		this.ruleIndex = ruleIndex;
		this.onSave = onSave;
		this.titleEl.setText(`Edit Rule ${ruleIndex + 1}: ${rule.fieldPath || rule.parentField || '(not set)'}`);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Store reference to title element for dynamic updates
		let titleElement: HTMLElement | null = null;

		// Helper function to update full field path
		const updateFieldPath = async () => {
			if (this.rule.parentField) {
				this.rule.fieldPath = this.rule.childField
					? `${this.rule.parentField}.${this.rule.childField}`
					: this.rule.parentField;
			} else {
				this.rule.fieldPath = '';
			}

			// Update modal title
			if (titleElement) {
				const displayPath = this.rule.fieldPath || this.rule.parentField || '(not set)';
				titleElement.setText(`Edit Rule ${this.ruleIndex + 1}: ${displayPath}`);
			}
		};

		// Field Path Settings
		contentEl.createEl('h3', { text: 'Field Path' });

		new Setting(contentEl)
			.setName('Parent Field')
			.setDesc('e.g., "Habits Yestoday", "Tags", "Project"')
			.addText(text => text
				.setPlaceholder('Parent field name')
				.setValue(this.rule.parentField)
				.onChange(async (value) => {
					this.rule.parentField = value;
					await updateFieldPath();
				})
			);

		new Setting(contentEl)
			.setName('Child Field')
			.setDesc('Optional - leave empty for top-level field')
			.addText(text => text
				.setPlaceholder('Child field name (optional)')
				.setValue(this.rule.childField || '')
				.onChange(async (value) => {
					this.rule.childField = value || '';
					await updateFieldPath();
				})
			);

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional description for this rule')
			.addText(text => text
				.setPlaceholder('Description')
				.setValue(this.rule.description || '')
				.onChange(async (value) => {
					this.rule.description = value;
				})
			);

		// Multi-select mode
		new Setting(contentEl)
			.setName('Enable Multi-Select')
			.setDesc('Allow selecting multiple items at once (Space to toggle, Ctrl+Enter to confirm)')
			.addToggle(toggle => toggle
				.setValue(this.rule.multiSelect || false)
				.onChange(async (value) => {
					this.rule.multiSelect = value;
				})
			);

		// Source Type
		contentEl.createEl('h3', { text: 'Source' });

		new Setting(contentEl)
			.setName('Source Type')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'inline': 'Inline Options',
					'vault-tags': 'Vault Tags',
					'vault-files': 'Vault Files',
					'date': 'Date Picker',
					'recent-values': 'Recent Values'
				})
				.setValue(this.rule.sourceType)
				.onChange(async (value) => {
					this.rule.sourceType = value as any;
					// Re-render the modal to show source-specific settings
					this.onOpen();
				})
			);

		// Source-specific settings
		if (this.rule.sourceType === 'inline') {
			this.renderInlineOptions(contentEl);
		}

		// Save and Cancel buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		const saveButton = buttonContainer.createEl('button', { text: 'Save' });
		saveButton.style.flex = '1';
		saveButton.onclick = async () => {
			await this.onSave(this.rule);
			this.close();
		};

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.style.flex = '1';
		cancelButton.onclick = () => this.close();
	}

	private renderInlineOptions(container: HTMLElement): void {
		container.createEl('h4', { text: 'Options' });

		const desc = container.createDiv({ cls: 'setting-item-description' });
		desc.createEl('p', { text: 'Format: key: type | params (one per line)' });
		desc.createEl('p', { text: 'Types: number, boolean, enum' });
		desc.createEl('p', { text: 'Examples:' });
		const exampleList = desc.createEl('ul');
		exampleList.createEl('li', { text: 'running: number | km, miles' });
		exampleList.createEl('li', { text: 'push_ups: number' });
		exampleList.createEl('li', { text: 'completed: boolean' });
		exampleList.createEl('li', { text: 'mood: enum | happy, sad, tired' });

		const textArea = container.createEl('textarea', {
			cls: 'frontmatter-options-textarea',
			attr: {
				rows: '10',
				placeholder: 'key: type | params'
			}
		});

		// Convert options to text
		const optionsText = (this.rule.options || [])
			.map(opt => {
				// New format with type
				if (opt.type) {
					let line = `${opt.key}: ${opt.type}`;
					if (opt.type === 'number' && opt.units && opt.units.length > 0) {
						line += ` | ${opt.units.join(', ')}`;
					} else if (opt.type === 'enum' && opt.enumValues && opt.enumValues.length > 0) {
						line += ` | ${opt.enumValues.join(', ')}`;
					}
					return line;
				} else {
					// Legacy format
					let line = opt.key;
					if (opt.description) line += ` | ${opt.description}`;
					if (opt.icon) line += ` | ${opt.icon}`;
					return line;
				}
			})
			.join('\n');

		textArea.value = optionsText;

		textArea.addEventListener('blur', async () => {
			this.rule.options = this.parseOptionsText(textArea.value);
		});

		const stats = container.createDiv({ cls: 'frontmatter-options-stats' });
		stats.setText(`Lines: ${(this.rule.options || []).length}`);
	}

	private parseOptionsText(text: string): OptionItem[] {
		return text.split('\n')
			.map(line => line.trim())
			.filter(line => line !== '')
			.map(line => {
				// New format: "key: type | param1, param2"
				// Old format: "key | description | icon"

				// Check if line contains type declaration (has ":")
				if (line.includes(':')) {
					return this.parseTypedOption(line);
				} else {
					// Legacy format
					const parts = line.split('|').map(p => p.trim());
					return {
						key: parts[0],
						description: parts[1] || undefined,
						icon: parts[2] || undefined
					};
				}
			})
			.filter(opt => opt.key !== '');
	}

	private parseTypedOption(line: string): OptionItem {
		// Format: "key: type | param1, param2"
		const colonIndex = line.indexOf(':');
		const key = line.substring(0, colonIndex).trim();
		const rest = line.substring(colonIndex + 1).trim();

		const parts = rest.split('|').map(p => p.trim());
		const type = parts[0] as 'number' | 'boolean' | 'enum';

		const option: OptionItem = { key, type };

		// Parse type-specific parameters
		if (type === 'number' && parts[1]) {
			// Units: "km, miles"
			option.units = parts[1].split(',').map(u => u.trim()).filter(u => u !== '');
		} else if (type === 'enum' && parts[1]) {
			// Enum values: "happy, neutral, sad"
			option.enumValues = parts[1].split(',').map(v => v.trim()).filter(v => v !== '');
		}

		return option;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
