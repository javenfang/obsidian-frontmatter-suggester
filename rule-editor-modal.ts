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

		// Value Settings
		this.renderValueSettings(contentEl);

		// Display Settings
		this.renderDisplaySettings(contentEl);

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
		desc.createEl('p', { text: 'Format: key|description|icon (one per line)' });
		desc.createEl('p', { text: 'Examples:' });
		const exampleList = desc.createEl('ul');
		exampleList.createEl('li', { text: 'hiking' });
		exampleList.createEl('li', { text: 'running|跑步' });
		exampleList.createEl('li', { text: 'push_up|俯卧撑|💪' });

		const textArea = container.createEl('textarea', {
			cls: 'frontmatter-options-textarea',
			attr: {
				rows: '10',
				placeholder: 'key|description|icon'
			}
		});

		// Convert options to text
		const optionsText = (this.rule.options || [])
			.map(opt => {
				let line = opt.key;
				if (opt.description) line += `|${opt.description}`;
				if (opt.icon) line += `|${opt.icon}`;
				return line;
			})
			.join('\n');

		textArea.value = optionsText;

		textArea.addEventListener('blur', async () => {
			this.rule.options = this.parseOptionsText(textArea.value);
		});

		const stats = container.createDiv({ cls: 'frontmatter-options-stats' });
		stats.setText(`Lines: ${(this.rule.options || []).length}`);
	}

	private renderValueSettings(container: HTMLElement): void {
		container.createEl('h3', { text: 'Value Settings' });

		// Initialize valueConfig if not exists
		if (!this.rule.valueConfig) {
			this.rule.valueConfig = {
				type: 'number',
				unitBehavior: 'optional',
				outputFormat: 'simple'
			};
		}

		new Setting(container)
			.setName('Value Type')
			.setDesc('Type of value expected after the key')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'number': 'Number',
					'text': 'Text',
					'none': 'None (key only)'
				})
				.setValue(this.rule.valueConfig?.type || 'number')
				.onChange(async (value) => {
					this.rule.valueConfig!.type = value as any;
					// Re-render to show/hide units and attributes
					this.onOpen();
				})
			);

		// Units (for number type)
		if (this.rule.valueConfig.type === 'number') {
			const unitsDesc = container.createDiv({ cls: 'setting-item-description' });
			unitsDesc.createEl('p', { text: 'Units (optional, format: unit|description)' });
			unitsDesc.createEl('p', { text: 'Examples: km|公里, 次|次数, g|克' });

			const unitsTextArea = container.createEl('textarea', {
				cls: 'frontmatter-units-textarea',
				attr: {
					rows: '5',
					placeholder: 'unit|description'
				}
			});

			const unitsText = (this.rule.valueConfig.units || [])
				.map(u => `${u.unit}${u.description ? '|' + u.description : ''}`)
				.join('\n');

			unitsTextArea.value = unitsText;

			unitsTextArea.addEventListener('blur', async () => {
				this.rule.valueConfig!.units = this.parseUnitsText(unitsTextArea.value);
			});

			// Default unit - with (none) option as first
			if (this.rule.valueConfig.units && this.rule.valueConfig.units.length > 0) {
				new Setting(container)
					.setName('Default Unit')
					.setDesc('Leave empty (none) or select a unit as default')
					.addDropdown(dropdown => {
						dropdown.addOption('', '(none) - no default unit');
						this.rule.valueConfig!.units!.forEach(u => {
							dropdown.addOption(u.unit, u.unit);
						});
						dropdown.setValue(this.rule.valueConfig!.defaultUnit || '');
						dropdown.onChange(async (value) => {
							this.rule.valueConfig!.defaultUnit = value || undefined;
						});
					});
			}
		}
	}


	private renderDisplaySettings(container: HTMLElement): void {
		container.createEl('h3', { text: 'Display Settings' });

		if (!this.rule.displayFormat) {
			this.rule.displayFormat = {
				showDescription: true,
				showIcon: true
			};
		}

		new Setting(container)
			.setName('Show description in suggestions')
			.addToggle(toggle => toggle
				.setValue(this.rule.displayFormat!.showDescription)
				.onChange(async (value) => {
					this.rule.displayFormat!.showDescription = value;
				})
			);

		new Setting(container)
			.setName('Show icon in suggestions')
			.addToggle(toggle => toggle
				.setValue(this.rule.displayFormat!.showIcon)
				.onChange(async (value) => {
					this.rule.displayFormat!.showIcon = value;
				})
			);
	}

	private parseOptionsText(text: string): OptionItem[] {
		return text.split('\n')
			.map(line => line.trim())
			.filter(line => line !== '')
			.map(line => {
				const parts = line.split('|').map(p => p.trim());
				return {
					key: parts[0],
					description: parts[1] || undefined,
					icon: parts[2] || undefined
				};
			})
			.filter(opt => opt.key !== '');
	}

	private parseUnitsText(text: string): { unit: string; description?: string }[] {
		return text.split('\n')
			.map(line => line.trim())
			.filter(line => line !== '')
			.map(line => {
				const parts = line.split('|').map(p => p.trim());
				return {
					unit: parts[0],
					description: parts[1] || undefined
				};
			})
			.filter(u => u.unit !== '');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
