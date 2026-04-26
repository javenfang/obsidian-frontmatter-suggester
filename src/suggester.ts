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
	private isMultiSelectMode: boolean = false;

	constructor(app: App, settings: PluginSettings) {
		super(app);
		this.settings = settings;
		this.setInstructions([
			{ command: '↑↓', purpose: 'Navigate' },
			{ command: 'Enter', purpose: 'Insert' },
			{ command: 'Esc', purpose: 'Close' }
		]);
	}

	updateSettings(settings: PluginSettings) {
		this.settings = settings;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		if (!file) return null;
		if (!FrontmatterParser.isInFrontmatter(cursor, editor)) return null;

		const context = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!context) return null;

		const matchingRule = this.findMatchingRule(context.path);
		if (!matchingRule || !matchingRule.enabled) return null;

		const suggestions = this.generateSuggestions(matchingRule, cursor, editor);
		if (suggestions.length === 0) return null;

		const currentLine = editor.getLine(cursor.line);
		const fieldName = FrontmatterParser.extractFieldName(currentLine);
		let startCh: number;

		if (fieldName) {
			startCh = context.indent + fieldName.length + 1;
			while (startCh < currentLine.length && currentLine[startCh] === ' ') {
				startCh++;
			}
		} else {
			startCh = cursor.ch;
		}

		const query = currentLine.substring(startCh, cursor.ch);

		return {
			start: { line: cursor.line, ch: startCh },
			end: cursor,
			query: query
		};
	}

	getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
		const cursor = context.editor.getCursor();
		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, context.editor);
		if (!fieldContext) return [];

		const matchingRule = this.findMatchingRule(fieldContext.path);
		if (!matchingRule || !matchingRule.enabled) return [];

		this.isMultiSelectMode = matchingRule.multiSelect || false;

		let suggestions = this.generateSuggestions(matchingRule, cursor, context.editor);
		if (suggestions.length === 0) return [];

		const ruleFieldPath = matchingRule.fieldPath || matchingRule.parentField;
		const ruleDepth = this.calculatePathDepth(ruleFieldPath);
		const pathDepth = this.calculatePathDepth(fieldContext.path);

		if (pathDepth === ruleDepth && context.query && context.query.trim() !== '') {
			suggestions = this.filterSuggestions(suggestions, context.query);
		}

		return suggestions.slice(0, this.settings.globalSettings.maxSuggestions);
	}

	renderSuggestion(suggestion: SuggestionItem, el: HTMLElement): void {
		el.createDiv({ cls: 'frontmatter-suggestion-item' }, (div) => {
			if (suggestion.option.icon && suggestion.rule.displayFormat?.showIcon !== false) {
				div.createSpan({ cls: 'frontmatter-suggestion-icon', text: suggestion.option.icon });
			}
			div.createSpan({ cls: 'frontmatter-suggestion-key', text: suggestion.option.key });
			if (suggestion.option.description && suggestion.rule.displayFormat?.showDescription !== false) {
				div.createSpan({ cls: 'frontmatter-suggestion-desc', text: ` - ${suggestion.option.description}` });
			}
		});
	}

	/**
	 * Insert sub-item after the last existing sub-item (preserving pick order).
	 * In multi-select mode, return the cursor to the parent field line so
	 * EditorSuggest's onTrigger fires again with a dedup-filtered list and
	 * the dropdown re-opens automatically. The cursor reposition is deferred
	 * via setTimeout so it runs after Obsidian's built-in auto-close.
	 */
	selectSuggestion(suggestion: SuggestionItem, _evt: MouseEvent | KeyboardEvent): void {
		const editor = (this.context as EditorSuggestContext).editor;
		const cursor = editor.getCursor();

		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!fieldContext) return;

		const matchingRule = this.findMatchingRule(fieldContext.path);
		if (!matchingRule) return;

		const ruleFieldPath = matchingRule.fieldPath || matchingRule.parentField;
		const parentLine = this.findRuleParentLine(ruleFieldPath, editor);
		if (parentLine === null) return;

		const parentLineText = editor.getLine(parentLine);
		const parentIndent = FrontmatterParser.getIndent(parentLineText);
		const subIndent = parentIndent + 2;
		const indentStr = ' '.repeat(subIndent);

		const insertAfterLine = this.findLastSubItemLine(editor, parentLine, parentIndent, subIndent);
		const insertAfterText = editor.getLine(insertAfterLine);
		const newLineText = `\n${indentStr}${suggestion.option.key}: `;

		editor.replaceRange(
			newLineText,
			{ line: insertAfterLine, ch: insertAfterText.length }
		);

		if (!this.isMultiSelectMode) {
			// Single-select: leave cursor at value position of inserted item.
			editor.setCursor({
				line: insertAfterLine + 1,
				ch: subIndent + suggestion.option.key.length + 2
			});
			return;
		}

		// Multi-select: bounce cursor back to the parent field line end.
		// Defer so it happens after Obsidian's post-select auto-close, ensuring
		// the cursor change re-triggers onTrigger and the dropdown re-opens
		// with the dedup-filtered remaining options.
		setTimeout(() => {
			const text = editor.getLine(parentLine);
			editor.setCursor({ line: parentLine, ch: text.length });
		}, 0);
	}

	/**
	 * Find the editor line where a rule's parent field lives.
	 * Walks the path segment by segment by indent (each level = +2 spaces).
	 */
	private findRuleParentLine(ruleFieldPath: string, editor: Editor): number | null {
		const bounds = FrontmatterParser.getFrontmatterBounds(editor);
		if (!bounds) return null;

		const parts = ruleFieldPath.split('.').filter(p => p.length > 0);
		if (parts.length === 0) return null;

		let currentLine = -1;
		for (let i = bounds.start + 1; i < bounds.end; i++) {
			const line = editor.getLine(i);
			if (
				FrontmatterParser.getIndent(line) === 0 &&
				FrontmatterParser.extractFieldName(line) === parts[0]
			) {
				currentLine = i;
				break;
			}
		}
		if (currentLine === -1) return null;

		for (let p = 1; p < parts.length; p++) {
			const nestedName = parts[p];
			const expectedIndent = p * 2;
			let found = false;
			for (let j = currentLine + 1; j < bounds.end; j++) {
				const line = editor.getLine(j);
				const indent = FrontmatterParser.getIndent(line);
				if (indent < expectedIndent && line.trim() !== '') break;
				if (
					FrontmatterParser.extractFieldName(line) === nestedName &&
					indent === expectedIndent
				) {
					currentLine = j;
					found = true;
					break;
				}
			}
			if (!found) return null;
		}
		return currentLine;
	}

	/**
	 * Find the last existing sub-item line under a parent. Returns parentLine
	 * itself if there are no sub-items yet (so a new sub-item gets inserted
	 * right below the parent).
	 */
	private findLastSubItemLine(
		editor: Editor,
		parentLine: number,
		parentIndent: number,
		subIndent: number
	): number {
		const bounds = FrontmatterParser.getFrontmatterBounds(editor);
		if (!bounds) return parentLine;

		let last = parentLine;
		for (let l = parentLine + 1; l < bounds.end; l++) {
			const text = editor.getLine(l);
			const indent = FrontmatterParser.getIndent(text);
			// Stop when we leave this parent's group (next sibling/parent field)
			if (text.trim() !== '' && indent <= parentIndent) break;
			if (
				indent === subIndent &&
				FrontmatterParser.extractFieldName(text) !== null
			) {
				last = l;
			}
		}
		return last;
	}

	private calculatePathDepth(fieldPath: string): number {
		return fieldPath.split('.').filter(p => p.length > 0).length;
	}

	private findMatchingRule(fieldPath: string): FieldRule | null {
		for (const rule of this.settings.rules) {
			if (rule.fieldPath === fieldPath) return rule;
		}
		for (const rule of this.settings.rules) {
			if (fieldPath.startsWith(rule.fieldPath + '.')) return rule;
		}
		return null;
	}

	private generateSuggestions(
		rule: FieldRule,
		cursor: EditorPosition,
		editor: Editor
	): SuggestionItem[] {
		const fieldContext = FrontmatterParser.getCurrentFieldPath(cursor, editor);
		if (!fieldContext) return [];

		const ruleFieldPath = rule.fieldPath || rule.parentField;
		const ruleDepth = this.calculatePathDepth(ruleFieldPath);
		const pathDepth = this.calculatePathDepth(fieldContext.path);

		if (pathDepth === ruleDepth) {
			return this.generateParentFieldSuggestions(rule, editor);
		}

		return [];
	}

	private generateParentFieldSuggestions(
		rule: FieldRule,
		editor: Editor
	): SuggestionItem[] {
		const suggestions: SuggestionItem[] = [];
		const ruleFieldPath = rule.fieldPath || rule.parentField;

		const existingItems = FrontmatterParser.getExistingSubItemsByPath(
			ruleFieldPath,
			editor
		);

		switch (rule.sourceType) {
			case 'inline':
				if (rule.options) {
					for (const option of rule.options) {
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
			case 'vault-files':
			case 'date':
			case 'recent-values':
				// TODO
				break;
		}

		return suggestions;
	}

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

	private buildInsertText(option: OptionItem): string {
		return `${option.key}: `;
	}
}
