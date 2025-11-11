import { Editor, EditorPosition, MarkdownView, Notice, editorViewField } from 'obsidian';
import { FieldRule, PluginSettings } from './types';
import { FrontmatterParser } from './frontmatter-parser';
import { ValueValidator } from './validator';
import { OptionValidator } from './option-validator';
import { ValidationDecorator, ValidationError } from './validation-decorator';

export class ValueValidatorExtension {
	private settings: PluginSettings;
	private validationTimeouts: Map<string, NodeJS.Timeout> = new Map();
	private decorator: ValidationDecorator;
	private lastValidatedContent: Map<string, string> = new Map();

	constructor(settings: PluginSettings) {
		this.settings = settings;
		this.decorator = new ValidationDecorator();
	}

	updateSettings(settings: PluginSettings) {
		this.settings = settings;
	}

	/**
	 * Validate value at current cursor position
	 * Called when user moves cursor or edits text
	 */
	validateAtCursor(editor: Editor, view: MarkdownView): void {
		const cursor = editor.getCursor();

		// Must be in frontmatter
		if (!FrontmatterParser.isInFrontmatter(cursor, editor)) {
			if (view.file) {
				this.decorator.clearErrors(view.file.path);
			}
			return;
		}

		// Get content hash to prevent duplicate validation
		const content = editor.getValue();
		const contentKey = `${view.file?.path}-${cursor.line}`;

		if (this.lastValidatedContent.get(contentKey) === content) {
			// Content hasn't changed, skip validation
			return;
		}

		this.lastValidatedContent.set(contentKey, content);

		// Validate all frontmatter values
		const errors = this.validateAllFrontmatter(editor);

		// Update decorations
		if (view.file) {
			this.decorator.setErrors(view.file.path, errors);
		}

		// Show toast for errors on current line only
		const currentLineErrors = errors.filter(error => {
			const errorPos = editor.offsetToPos(error.from);
			return errorPos.line === cursor.line;
		});

		if (currentLineErrors.length > 0) {
			this.showValidationToast(currentLineErrors[0].result);
		}
	}

	/**
	 * Validate all frontmatter values and return errors
	 */
	private validateAllFrontmatter(editor: Editor): ValidationError[] {
		const errors: ValidationError[] = [];
		const lineCount = editor.lineCount();

		for (let line = 0; line < lineCount; line++) {
			const pos: EditorPosition = { line, ch: 0 };

			// Check if in frontmatter
			if (!FrontmatterParser.isInFrontmatter(pos, editor)) {
				continue;
			}

			// Get field context
			const fieldContext = FrontmatterParser.getCurrentFieldPath(pos, editor);
			if (!fieldContext) {
				continue;
			}

			// Find matching rule
			const matchingRule = this.findMatchingRule(fieldContext.path);
			if (!matchingRule || !matchingRule.enabled) {
				continue;
			}

			// Check if this is a value line
			const currentLine = editor.getLine(line);
			const colonIndex = currentLine.indexOf(':');

			if (colonIndex === -1) {
				continue;
			}

			// Extract key and value
			const keyPart = currentLine.substring(0, colonIndex).trim();
			const valuePart = currentLine.substring(colonIndex + 1).trim();

			if (!valuePart) {
				continue;
			}

			// Find matching option for this key
			const matchingOption = matchingRule.options?.find(opt => opt.key === keyPart);

			// Perform validation
			let result;
			if (matchingOption && matchingOption.type) {
				// Use option-level validation
				result = OptionValidator.validate(valuePart, matchingOption);
			} else if (matchingRule.valueConfig) {
				// Fallback to legacy value-level validation
				result = ValueValidator.validate(valuePart, matchingRule.valueConfig);
			} else {
				// No validation configured
				continue;
			}

			if (!result.valid) {
				// Calculate character positions for the value
				const valueStart = currentLine.indexOf(valuePart, colonIndex);
				const from = editor.posToOffset({ line, ch: valueStart });
				const to = editor.posToOffset({ line, ch: valueStart + valuePart.length });

				errors.push({
					from,
					to,
					result
				});
			}
		}

		return errors;
	}

	/**
	 * Debounced validation - validates after user stops typing
	 */
	validateWithDebounce(editor: Editor, view: MarkdownView, delay: number = 500): void {
		const cursor = editor.getCursor();
		const lineKey = `${view.file?.path}-${cursor.line}`;

		// Clear existing timeout
		const existingTimeout = this.validationTimeouts.get(lineKey);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Set new timeout
		const timeout = setTimeout(() => {
			this.validateAtCursor(editor, view);
			this.validationTimeouts.delete(lineKey);
		}, delay);

		this.validationTimeouts.set(lineKey, timeout);
	}

	/**
	 * Find matching rule for a field path
	 */
	private findMatchingRule(fieldPath: string): FieldRule | null {
		// Check exact match
		for (const rule of this.settings.rules) {
			if (rule.fieldPath === fieldPath) {
				return rule;
			}
		}

		// Check if fieldPath is under a parent field
		for (const rule of this.settings.rules) {
			if (fieldPath.startsWith(rule.fieldPath + '.')) {
				return rule;
			}
		}

		return null;
	}

	/**
	 * Show validation toast notification
	 */
	private showValidationToast(result: { error?: string; suggestion?: string }): void {
		// Create custom modal-like notification in center
		const container = document.createElement('div');
		container.className = 'frontmatter-validation-modal';

		const content = container.createDiv({ cls: 'frontmatter-validation-modal-content' });

		const title = content.createDiv({ cls: 'frontmatter-validation-modal-title' });
		title.createSpan({ text: '⚠️ ' });
		title.createSpan({ text: result.error || 'Validation error' });

		if (result.suggestion) {
			const suggestion = content.createDiv({ cls: 'frontmatter-validation-modal-suggestion' });
			suggestion.createSpan({ text: '💡 ' });
			suggestion.createSpan({ text: result.suggestion });
		}

		document.body.appendChild(container);

		// Auto remove after 3 seconds
		setTimeout(() => {
			container.classList.add('frontmatter-validation-modal-fade-out');
			setTimeout(() => {
				container.remove();
			}, 300);
		}, 3000);
	}


	/**
	 * Get the decorator instance
	 */
	getDecorator(): ValidationDecorator {
		return this.decorator;
	}

	/**
	 * Cleanup timeouts
	 */
	cleanup(): void {
		for (const timeout of this.validationTimeouts.values()) {
			clearTimeout(timeout);
		}
		this.validationTimeouts.clear();
	}
}
