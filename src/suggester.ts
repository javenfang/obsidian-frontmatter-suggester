import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile
} from 'obsidian';
import { FieldRule, PluginSettings, SuggestionItem, OptionItem } from './types';
import { FrontmatterParser } from './frontmatter-parser';

export class FrontmatterSuggester extends EditorSuggest<SuggestionItem> {
	private settings: PluginSettings;
	private selectedItems: Set<string> = new Set();
	private isMultiSelectMode: boolean = false;
	private currentSuggestions: SuggestionItem[] = [];

	constructor(app: App, settings: PluginSettings) {
		super(app);
		this.settings = settings;
		this.setInstructions([
			{ command: '↑↓', purpose: 'Navigate' },
			{ command: 'Enter', purpose: 'Toggle/Insert' },
			{ command: 'Esc', purpose: 'Insert selected & close' }
		]);
	}

	updateSettings(settings: PluginSettings) {
		this.settings = settings;
	}

	/**
	 * Determine when to show suggestions
	 */
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		// Must have a file
		if (!file) {
			return null;
		}

		// Must be in frontmatter
		if (!FrontmatterParser.isInFrontmatter(cursor, editor)) {
				return null;
		}

		// Get current field path
		const context = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!context) return null;

		// Find matching rule
		const matchingRule = this.findMatchingRule(context.path);
		if (!matchingRule || !matchingRule.enabled) {
			return null;
		}

		// Get suggestions to check if there are any
		const suggestions = this.generateSuggestions(matchingRule, cursor, editor);
		if (suggestions.length === 0) {
			return null;
		}

		// Calculate start position based on field type (only for Case 1 parent field level)
		const currentLine = editor.getLine(cursor.line);
		const fieldName = FrontmatterParser.extractFieldName(currentLine);
		let startCh: number;

		if (fieldName) {
			// Case 1: Parent field line - position after colon and spaces
			startCh = context.indent + fieldName.length + 1; // +1 for ":"
			// Skip spaces after colon
			while (startCh < currentLine.length && currentLine[startCh] === ' ') {
				startCh++;
			}
		} else {
			// Case 1b or Case 2: No field name on line - use cursor position
			startCh = cursor.ch;
		}

		// Query should be the text from startCh to cursor position
		const query = currentLine.substring(startCh, cursor.ch);

		const triggerInfo = {
			start: { line: cursor.line, ch: startCh },
			end: cursor,
			query: query
		};

		return triggerInfo;
	}

	/**
	 * Generate suggestion list
	 */
	getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
		const cursor = context.editor.getCursor();
		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, context.editor);
		if (!fieldContext) {
			return [];
		}

		const matchingRule = this.findMatchingRule(fieldContext.path);
		if (!matchingRule || !matchingRule.enabled) {
			return [];
		}

		// Set multi-select mode based on rule configuration
		this.isMultiSelectMode = matchingRule.multiSelect || false;

		// Reset selected items when suggestions are generated (new suggestion session)
		if (!this.context || this.context !== context) {
			this.selectedItems.clear();
		}

		let suggestions = this.generateSuggestions(matchingRule, cursor, context.editor);
		if (suggestions.length === 0) {
			return [];
		}

		// Filter by query only for Case 1 (parent field level, not child item attributes)
		const ruleFieldPath = matchingRule.fieldPath || matchingRule.parentField;
		const ruleDepth = this.calculatePathDepth(ruleFieldPath);
		const pathDepth = this.calculatePathDepth(fieldContext.path);

		if (pathDepth === ruleDepth && context.query && context.query.trim() !== '') {
			suggestions = this.filterSuggestions(suggestions, context.query);
		}

		// Limit to max suggestions
		const result = suggestions.slice(0, this.settings.globalSettings.maxSuggestions);
		this.currentSuggestions = result;
		return result;
	}

	/**
	 * Override close method to handle multi-select confirmation
	 */
	close(): void {
		// In multi-select mode, if there are selected items, insert them before closing
		if (this.isMultiSelectMode && this.selectedItems.size > 0 && this.context) {
			const editor = (this.context as EditorSuggestContext).editor;
			const cursor = editor.getCursor();
			const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, editor);

			if (fieldContext) {
				this.handleMultiSelection(editor, cursor, fieldContext);
			}
		}

		// Call parent close method
		super.close();
	}

	/**
	 * Render each suggestion
	 */
	renderSuggestion(suggestion: SuggestionItem, el: HTMLElement): void {
		el.createDiv({ cls: 'frontmatter-suggestion-item' }, (div) => {
			// Checkbox indicator for multi-select mode
			if (this.isMultiSelectMode) {
				const isSelected = this.selectedItems.has(suggestion.option.key);
				const checkbox = isSelected ? '[✓] ' : '[ ] ';
				div.createSpan({ cls: 'frontmatter-suggestion-checkbox', text: checkbox });
			}

			// Icon (if available)
			if (suggestion.option.icon && suggestion.rule.displayFormat?.showIcon !== false) {
				div.createSpan({ cls: 'frontmatter-suggestion-icon', text: suggestion.option.icon });
			}

			// Key
			div.createSpan({ cls: 'frontmatter-suggestion-key', text: suggestion.option.key });

			// Description (if available)
			if (suggestion.option.description && suggestion.rule.displayFormat?.showDescription !== false) {
				div.createSpan({ cls: 'frontmatter-suggestion-desc', text: ` - ${suggestion.option.description}` });
			}

			// Show selected count hint in multi-select mode
			if (this.isMultiSelectMode && this.selectedItems.size > 0) {
				div.createSpan({
					cls: 'frontmatter-suggestion-hint',
					text: ` (${this.selectedItems.size} selected)`
				});
			}
		});
	}

	/**
	 * Handle suggestion selection
	 * In multi-select mode: toggles selection
	 * In single-select mode: inserts immediately
	 */
	selectSuggestion(suggestion: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
		const editor = (this.context as EditorSuggestContext).editor;
		const cursor = editor.getCursor();

		// Get field context to determine what type of insertion is needed
		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!fieldContext) return;

		if (this.isMultiSelectMode) {
			// Multi-select mode: Enter toggles selection
			// Toggle: add/remove from selection
			if (this.selectedItems.has(suggestion.option.key)) {
				this.selectedItems.delete(suggestion.option.key);
			} else {
				this.selectedItems.add(suggestion.option.key);
			}

			// Force UI update by re-rendering all suggestions
			this.updateSuggestionsDisplay();
		} else {
			// Single-select mode: insert immediately and close
			this.handleParentFieldSelection(suggestion, editor, cursor, fieldContext);
		}
	}

	/**
	 * Update the suggestions display to reflect current selection state
	 */
	private updateSuggestionsDisplay(): void {
		// Get the suggestion container element
		const suggestEl = (this as any).suggestEl;
		if (!suggestEl) return;

		// Find all suggestion elements and update them
		const suggestionEls = suggestEl.querySelectorAll('.suggestion-item');
		this.currentSuggestions.forEach((suggestion, index) => {
			const el = suggestionEls[index];
			if (el) {
				// Clear and re-render
				el.empty();
				this.renderSuggestion(suggestion, el);
			}
		});
	}

	/**
	 * Handle multi-selection insertion
	 */
	private handleMultiSelection(
		editor: Editor,
		cursor: EditorPosition,
		fieldContext: any
	): void {
		const currentLine = editor.getLine(cursor.line);
		const fieldName = FrontmatterParser.extractFieldName(currentLine);

		if (fieldName) {
			// Cursor is on parent field line
			const itemIndent = fieldContext.indent + 2;
			const indentStr = ' '.repeat(itemIndent);

			// Build text for all selected items
			const selectedArray = Array.from(this.selectedItems);
			const insertLines = selectedArray.map(key => `\n${indentStr}${key}: `).join('');

			// Insert at end of current line
			const insertPos = { line: cursor.line, ch: currentLine.length };
			editor.replaceRange(insertLines, insertPos);

			// Set cursor to end of last inserted item
			const newCursorPos = {
				line: cursor.line + selectedArray.length,
				ch: itemIndent + selectedArray[selectedArray.length - 1].length + 2
			};
			editor.setCursor(newCursorPos);
		} else {
			// Cursor is on an empty line
			const itemIndent = cursor.line > 0 ? FrontmatterParser.getIndent(currentLine) : fieldContext.indent + 2;
			const indentStr = ' '.repeat(itemIndent);

			const selectedArray = Array.from(this.selectedItems);
			const insertLines = selectedArray.map((key, index) => {
				return index === 0
					? `${indentStr}${key}: `
					: `\n${indentStr}${key}: `;
			}).join('');

			// Replace from current position
			const from = cursor;
			const to = { line: cursor.line, ch: currentLine.length };
			editor.replaceRange(insertLines, from, to);

			// Set cursor to end of last inserted item
			const newCursorPos = {
				line: cursor.line + selectedArray.length - 1,
				ch: itemIndent + selectedArray[selectedArray.length - 1].length + 2
			};
			editor.setCursor(newCursorPos);
		}

		// Clear selection after insertion
		this.selectedItems.clear();
	}

	/**
	 * Case 1: Handle selection on parent field level
	 * Example: User selects "阿托伐他汀" when cursor is on "Drugs:"
	 * Action: Insert new line with "  阿托伐他汀: "
	 */
	private handleParentFieldSelection(
		suggestion: SuggestionItem,
		editor: Editor,
		cursor: EditorPosition,
		fieldContext: any
	): void {
		const currentLine = editor.getLine(cursor.line);
		const fieldName = FrontmatterParser.extractFieldName(currentLine);

		if (fieldName) {
			// Cursor is on parent field line like "Drugs:"
			// Insert new line after this line with the sub-item
			const itemIndent = fieldContext.indent + 2;  // Sub-items are indented 2 more spaces
			const indentStr = ' '.repeat(itemIndent);
			const newLineText = `\n${indentStr}${suggestion.option.key}: `;

			// Insert at end of current line
			const insertPos = { line: cursor.line, ch: currentLine.length };
			editor.replaceRange(newLineText, insertPos);

			// Set cursor position at the end of inserted text
			const newCursorPos = {
				line: cursor.line + 1,
				ch: itemIndent + suggestion.option.key.length + 2  // +2 for ": "
			};
			editor.setCursor(newCursorPos);
		} else {
			// Cursor is on an empty sub-item line, insert the medication name
			const itemIndent = cursor.line > 0 ? FrontmatterParser.getIndent(currentLine) : fieldContext.indent + 2;
			const indentStr = ' '.repeat(itemIndent);
			const insertText = `${indentStr}${suggestion.option.key}: `;

			// Replace from current cursor position to end of line
			const from = cursor;
			const to = { line: cursor.line, ch: currentLine.length };
			editor.replaceRange(insertText, from, to);

			// Set cursor position after inserted text
			const newCursorPos = {
				line: cursor.line,
				ch: from.ch + insertText.length
			};
			editor.setCursor(newCursorPos);
		}
	}


	/**
	 * Calculate depth of a field path
	 * Example: "Habits Yestoday.Drugs" = 2 levels
	 */
	private calculatePathDepth(fieldPath: string): number {
		return fieldPath.split('.').filter(p => p.length > 0).length;
	}

	/**
	 * Find matching rule for a field path
	 */
	private findMatchingRule(fieldPath: string): FieldRule | null {
		// Exact match first
		for (const rule of this.settings.rules) {
			if (rule.fieldPath === fieldPath) {
				return rule;
			}
		}

		// Check if fieldPath is under a parent field
		// e.g., "Habits Yestoday.Exercises.hiking" should match "Habits Yestoday.Exercises"
		for (const rule of this.settings.rules) {
			if (fieldPath.startsWith(rule.fieldPath + '.')) {
				return rule;
			}
		}

		return null;
	}

	/**
	 * Generate suggestions based on rule and context
	 * Only generates parent field level suggestions
	 */
	private generateSuggestions(
		rule: FieldRule,
		cursor: EditorPosition,
		editor: Editor
	): SuggestionItem[] {
		// Get current field path with its YAML value
		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!fieldContext) return [];

		const ruleFieldPath = rule.fieldPath || rule.parentField;

		// Calculate depth to determine if we're on parent field or child item line
		const ruleDepth = this.calculatePathDepth(ruleFieldPath);
		const pathDepth = this.calculatePathDepth(fieldContext.path);

		// Only show suggestions at parent field level
		if (pathDepth === ruleDepth) {
			return this.generateParentFieldSuggestions(rule, cursor, editor);
		}

		return [];
	}

	/**
	 * Case 1: Generate suggestions for parent field level
	 * Example: Show medication options when cursor is on "Drugs:"
	 * User can select which medications to add
	 */
	private generateParentFieldSuggestions(
		rule: FieldRule,
		_cursor: EditorPosition,
		editor: Editor
	): SuggestionItem[] {
		const suggestions: SuggestionItem[] = [];
		const ruleFieldPath = rule.fieldPath || rule.parentField;

		// Get already added items to avoid duplicates
		const existingItems = FrontmatterParser.getExistingSubItemsByPath(
			ruleFieldPath,
			editor
		);

		// Generate suggestions based on source type
		switch (rule.sourceType) {
			case 'inline':
				if (rule.options) {
					for (const option of rule.options) {
						// Skip if already added
						if (existingItems.includes(option.key)) continue;

						suggestions.push({
							rule,
							option,
							displayText: this.buildDisplayText(option, rule),
							insertText: this.buildInsertText(option)
						});
					}
				}
				break;

			case 'vault-tags':
				// TODO: Implement vault tags
				break;

			case 'vault-files':
				// TODO: Implement vault files
				break;

			case 'date':
				// TODO: Implement date picker
				break;

			case 'recent-values':
				// TODO: Implement recent values
				break;
		}

		return suggestions;
	}


	/**
	 * Filter suggestions by query
	 */
	private filterSuggestions(suggestions: SuggestionItem[], query: string): SuggestionItem[] {
		const caseSensitive = this.settings.globalSettings.caseSensitive;
		const normalizedQuery = caseSensitive ? query : query.toLowerCase();

		return suggestions.filter(suggestion => {
			const key = caseSensitive ? suggestion.option.key : suggestion.option.key.toLowerCase();
			const desc = suggestion.option.description
				? (caseSensitive ? suggestion.option.description : suggestion.option.description.toLowerCase())
				: '';

			return key.includes(normalizedQuery) || desc.includes(normalizedQuery);
		});
	}

	/**
	 * Build display text for suggestion
	 */
	private buildDisplayText(option: OptionItem, rule: FieldRule): string {
		let text = option.key;

		if (option.description && rule.displayFormat?.showDescription !== false) {
			text += ` - ${option.description}`;
		}

		if (option.icon && rule.displayFormat?.showIcon !== false) {
			text = `${option.icon} ${text}`;
		}

		return text;
	}

	/**
	 * Build insert text for suggestion
	 */
	private buildInsertText(option: OptionItem): string {
		// Basic format: "key: "
		return `${option.key}: `;
	}
}
