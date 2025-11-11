import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { ValidationResult } from './types';

/**
 * Validation error widget for hover tooltips
 */
class ValidationErrorWidget extends WidgetType {
	constructor(private result: ValidationResult) {
		super();
	}

	toDOM(): HTMLElement {
		const tooltip = document.createElement('div');
		tooltip.className = 'frontmatter-validation-tooltip';

		// Title
		const title = tooltip.createDiv({ cls: 'frontmatter-validation-tooltip-title' });
		title.createSpan({ text: '⚠️' });
		title.createSpan({ text: 'Validation Error' });

		// Error message
		if (this.result.error) {
			tooltip.createDiv({
				cls: 'frontmatter-validation-tooltip-error',
				text: this.result.error
			});
		}

		// Suggestion
		if (this.result.suggestion) {
			const suggestionBox = tooltip.createDiv({ cls: 'frontmatter-validation-tooltip-suggestion' });
			suggestionBox.createSpan({
				cls: 'frontmatter-validation-tooltip-suggestion-icon',
				text: '💡'
			});
			suggestionBox.createSpan({
				cls: 'frontmatter-validation-tooltip-suggestion-text',
				text: this.result.suggestion
			});
		}

		return tooltip;
	}
}

/**
 * Store validation errors for a document
 */
export interface ValidationError {
	from: number;
	to: number;
	result: ValidationResult;
}

/**
 * Manage validation error decorations in the editor
 */
export class ValidationDecorator {
	private errors: Map<string, ValidationError[]> = new Map();

	/**
	 * Set validation errors for a file
	 */
	setErrors(filePath: string, errors: ValidationError[]): void {
		this.errors.set(filePath, errors);
	}

	/**
	 * Get validation errors for a file
	 */
	getErrors(filePath: string): ValidationError[] {
		return this.errors.get(filePath) || [];
	}

	/**
	 * Clear validation errors for a file
	 */
	clearErrors(filePath: string): void {
		this.errors.delete(filePath);
	}

	/**
	 * Clear all validation errors
	 */
	clearAllErrors(): void {
		this.errors.clear();
	}

	/**
	 * Build decorations for the current view
	 */
	buildDecorations(view: EditorView, filePath: string): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		const errors = this.getErrors(filePath);

		for (const error of errors.sort((a, b) => a.from - b.from)) {
			// Add wavy underline decoration
			builder.add(
				error.from,
				error.to,
				Decoration.mark({
					class: 'frontmatter-validation-error',
					attributes: {
						title: error.result.error || 'Validation error'
					}
				})
			);
		}

		return builder.finish();
	}
}

/**
 * Create a ViewPlugin for validation decorations
 */
export function createValidationPlugin(decorator: ValidationDecorator, getFilePath: () => string | undefined) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				const filePath = getFilePath();
				this.decorations = filePath
					? decorator.buildDecorations(view, filePath)
					: Decoration.none;
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					const filePath = getFilePath();
					this.decorations = filePath
						? decorator.buildDecorations(update.view, filePath)
						: Decoration.none;
				}
			}
		},
		{
			decorations: (v) => v.decorations
		}
	);
}
