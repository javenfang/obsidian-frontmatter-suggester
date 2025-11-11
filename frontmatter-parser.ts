import { Editor, EditorPosition } from 'obsidian';
import { FrontmatterBounds, FieldPathContext } from './types';
import * as yaml from 'js-yaml';

export class FrontmatterParser {
	/**
	 * Get frontmatter boundaries in the document
	 */
	static getFrontmatterBounds(editor: Editor): FrontmatterBounds | null {
		const firstLine = editor.getLine(0);
		if (!firstLine || firstLine.trim() !== '---') {
			return null;
		}

		// Find the closing ---
		const lineCount = editor.lineCount();
		for (let i = 1; i < lineCount; i++) {
			const line = editor.getLine(i);
			if (line.trim() === '---') {
				return { start: 0, end: i };
			}
		}

		return null;
	}

	/**
	 * Check if cursor is within frontmatter
	 */
	static isInFrontmatter(cursor: EditorPosition, editor: Editor): boolean {
		const bounds = this.getFrontmatterBounds(editor);
		if (!bounds) return false;

		return cursor.line > bounds.start && cursor.line < bounds.end;
	}

	/**
	 * Get indent level of a line (number of leading spaces)
	 */
	static getIndent(line: string): number {
		const match = line.match(/^(\s*)/);
		return match ? match[1].length : 0;
	}

	/**
	 * Extract field name from a line (e.g., "  Exercises:" -> "Exercises")
	 * Supports English, Chinese, and other Unicode characters
	 */
	static extractFieldName(line: string): string | null {
		// Match pattern: optional spaces + field name + colon + optional content
		// Field name can contain: letters, numbers, spaces, underscores, hyphens, Chinese characters, and other Unicode
		// Use [^\s:] to match any non-whitespace, non-colon character (simpler and more robust for Unicode)
		const match = line.match(/^\s*([^\s:]+(?:\s+[^\s:]+)*):\s*(.*)$/);
		if (!match) return null;

		const fieldName = match[1].trim();
		return fieldName || null;
	}

	/**
	 * Get the current field path at cursor position
	 * Returns path like "Habits Yestoday.Exercises"
	 * Uses YAML parsing with heuristic fallback
	 */
	static getCurrentFieldPath(cursor: EditorPosition, editor: Editor): FieldPathContext | null {
		const bounds = this.getFrontmatterBounds(editor);
		if (!bounds) return null;

		if (!this.isInFrontmatter(cursor, editor)) return null;

		// Try YAML parsing first
		let parsedYaml: Record<string, any> | null = null;
		try {
			const frontmatterLines = [];
			for (let i = bounds.start + 1; i < bounds.end; i++) {
				frontmatterLines.push(editor.getLine(i));
			}
			const frontmatterText = frontmatterLines.join('\n');
			parsedYaml = yaml.load(frontmatterText) as Record<string, any>;

			const result = this.getFieldPathFromYAML(parsedYaml, cursor, bounds.start + 1, editor);
			if (result) {
					return result;
			}
		} catch (error) {
			// YAML parsing failed, will fall back to heuristic method
		}

		// Fallback to heuristic method (indentation-based)
		return this.getCurrentFieldPathHeuristic(cursor, editor, bounds, parsedYaml);
	}

	/**
	 * Get field path from parsed YAML structure
	 */
	private static getFieldPathFromYAML(
		yamlObj: Record<string, any>,
		cursor: EditorPosition,
		frontmatterStart: number,
		editor: Editor
	): FieldPathContext | null {
		const currentLine = editor.getLine(cursor.line);
		const currentIndent = this.getIndent(currentLine);

		const path: string[] = [];
		let searchLine = cursor.line;
		let expectedParentIndent = currentIndent - 2;

		const currentField = this.extractFieldName(currentLine);
		if (currentField) {
			// Always add the current field to the path without verification
			// The field might not exist at the top level (e.g., nested field)
			// We verify the full path later
			path.unshift(currentField);
		} else {
			expectedParentIndent = currentIndent;
		}

		// Walk up to find parent fields
		// Note: We trust the indentation and field name extraction from the editor
		// The indentation-based structure is the source of truth here
		while (searchLine > frontmatterStart) {
			searchLine--;
			const line = editor.getLine(searchLine);
			if (line.trim() === '') continue;

			const indent = this.getIndent(line);
			const fieldName = this.extractFieldName(line);


			if (fieldName && indent === expectedParentIndent) {
				// Add parent field to path (trust indentation structure)
				path.unshift(fieldName);
				expectedParentIndent = indent - 2;
				}
		}

		if (path.length === 0) return null;

		// Get the actual value from YAML at this path
		const value = this.getValueFromYAML(yamlObj, path);

		return {
			path: path.join('.'),
			line: cursor.line,
			indent: currentIndent,
			value: value
		};
	}

	/**
	 * Get value from YAML object by path
	 */
	private static getValueFromYAML(yamlObj: Record<string, any>, pathArray: string[]): any {
		let current = yamlObj;
		for (const field of pathArray) {
			if (typeof current !== 'object' || current === null) {
				return undefined;
			}
			current = current[field];
		}
		return current;
	}

	/**
	 * Check if a field path exists in YAML structure
	 */
	private static fieldExistsInYAML(yamlObj: Record<string, any>, fieldPath: string[]): boolean {
		let current = yamlObj;

		for (const field of fieldPath) {
			if (typeof current !== 'object' || current === null) {
				return false;
			}

			if (!(field in current)) {
				return false;
			}

			current = current[field];
		}

		return true;
	}

	/**
	 * Heuristic field path detection (indentation-based, used as fallback)
	 */
	private static getCurrentFieldPathHeuristic(
		cursor: EditorPosition,
		editor: Editor,
		bounds: FrontmatterBounds,
		yamlObj?: Record<string, any> | null
	): FieldPathContext | null {
		const currentLine = editor.getLine(cursor.line);
		const currentIndent = this.getIndent(currentLine);

		const path: string[] = [];
		let searchLine = cursor.line;
		let expectedParentIndent = currentIndent - 2;

		const currentField = this.extractFieldName(currentLine);
		if (currentField) {
			path.unshift(currentField);
		} else {
			expectedParentIndent = currentIndent;
		}

		while (searchLine > bounds.start) {
			searchLine--;
			const line = editor.getLine(searchLine);
			if (line.trim() === '') continue;

			const indent = this.getIndent(line);
			const fieldName = this.extractFieldName(line);

			if (fieldName && indent === expectedParentIndent) {
				path.unshift(fieldName);
				expectedParentIndent = indent - 2;
			}
		}

		if (path.length === 0) return null;

		// Get value from YAML if available
		let value: any = undefined;
		if (yamlObj) {
			value = this.getValueFromYAML(yamlObj, path);
		}

		return {
			path: path.join('.'),
			line: cursor.line,
			indent: currentIndent,
			value: value
		};
	}

	/**
	 * Get already added sub-items under a field path
	 * For example, for "Habits Yestoday.Exercises", get ["push_up", "hiking"]
	 * Uses YAML parsing with heuristic fallback
	 */
	static getExistingSubItemsByPath(fieldPath: string, editor: Editor): string[] {
		const bounds = this.getFrontmatterBounds(editor);
		if (!bounds) return [];

		// Try YAML parsing first
		let yamlParsed = false;
		try {
			const frontmatterLines = [];
			for (let i = bounds.start + 1; i < bounds.end; i++) {
				frontmatterLines.push(editor.getLine(i));
			}
			const frontmatterText = frontmatterLines.join('\n');
			const parsed = yaml.load(frontmatterText) as Record<string, any>;
			yamlParsed = true;

			// Get subItems from YAML using the full field path
			const subItems = this.getExistingSubItemsFromYAMLByPath(parsed, fieldPath);
			// Return the YAML result even if empty (field exists but has no sub-items yet)
			return subItems;
		} catch (error) {
			// YAML parsing failed, will fall back to heuristic method
		}

		// Fallback to heuristic method only if YAML parsing failed
		const fieldLineNum = this.findFieldLineInEditor(fieldPath, editor, bounds);
		if (fieldLineNum === null) return [];
		return this.getExistingSubItemsHeuristic(fieldLineNum, editor, bounds);
	}

	/**
	 * Get already added sub-items under a field
	 * For example, under "Exercises:", get ["push_up", "hiking"]
	 * Uses YAML parsing with heuristic fallback
	 */
	static getExistingSubItems(fieldLine: number, editor: Editor): string[] {
		const bounds = this.getFrontmatterBounds(editor);
		if (!bounds) return [];

		// Try YAML parsing first
		try {
			const frontmatterLines = [];
			for (let i = bounds.start + 1; i < bounds.end; i++) {
				frontmatterLines.push(editor.getLine(i));
			}
			const frontmatterText = frontmatterLines.join('\n');
			const parsed = yaml.load(frontmatterText) as Record<string, any>;

			// Get field name from the field line
			const fieldLineText = editor.getLine(fieldLine);
			const fieldName = this.extractFieldName(fieldLineText);

			if (fieldName) {
				// Get subItems from YAML
				const subItems = this.getExistingSubItemsFromYAML(parsed, fieldName);
				if (subItems.length > 0) {
						return subItems;
				}
			}
		} catch (error) {
			// YAML parsing failed, will fall back to heuristic method
		}

		// Fallback to heuristic method
		return this.getExistingSubItemsHeuristic(fieldLine, editor, bounds);
	}

	/**
	 * Get sub-items from YAML structure using field path
	 * For example, fieldPath = "Habits Yestoday.Exercises"
	 */
	private static getExistingSubItemsFromYAMLByPath(yamlObj: Record<string, any>, fieldPath: string): string[] {
		if (!fieldPath || typeof yamlObj !== 'object' || yamlObj === null) {
			return [];
		}

		const parts = fieldPath.split('.');
		let current = yamlObj;

		// Navigate through the path
		for (const part of parts) {
			if (typeof current !== 'object' || current === null) {
				return [];
			}
			if (!(part in current)) {
				return [];
			}
			current = current[part];
		}


		// Get keys from current level if it's an object (not an array)
		if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
			const keys = Object.keys(current);
			return keys;
		}

		return [];
	}

	/**
	 * Get sub-items from YAML structure
	 */
	private static getExistingSubItemsFromYAML(yamlObj: Record<string, any>, fieldName: string): string[] {
		if (typeof yamlObj !== 'object' || yamlObj === null) {
			return [];
		}

		if (!(fieldName in yamlObj)) {
			return [];
		}

		const field = yamlObj[fieldName];

		if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
			return Object.keys(field);
		}

		return [];
	}

	/**
	 * Heuristic sub-items detection (indentation-based, used as fallback)
	 */
	private static getExistingSubItemsHeuristic(fieldLine: number, editor: Editor, bounds: FrontmatterBounds): string[] {
		const fieldLineText = editor.getLine(fieldLine);
		const fieldIndent = this.getIndent(fieldLineText);
		const expectedSubIndent = fieldIndent + 2;

		const subItems: string[] = [];
		let searchLine = fieldLine + 1;

		while (searchLine <= bounds.end) {
			const line = editor.getLine(searchLine);
			const indent = this.getIndent(line);

			// Stop if we hit a field at same or lower indent level
			if (indent <= fieldIndent && line.trim() !== '') {
				break;
			}

			// Collect sub-items at expected indent
			if (indent === expectedSubIndent) {
				const itemName = this.extractFieldName(line);
				if (itemName) {
					subItems.push(itemName);
				}
			}

			searchLine++;
		}

		return subItems;
	}

	/**
	 * Get the partial text user has typed at cursor position
	 * Used for filtering suggestions
	 */
	static getPartialInput(cursor: EditorPosition, editor: Editor): string {
		const line = editor.getLine(cursor.line);
		const beforeCursor = line.substring(0, cursor.ch);

		// Extract text after indent and before cursor
		const match = beforeCursor.match(/^\s*(.*)$/);
		return match ? match[1] : '';
	}

	/**
	 * Calculate expected indent for a field path
	 * e.g., "Tags" -> 0, "Habits.Exercises" -> 4
	 */
	static calculateIndent(fieldPath: string): number {
		const depth = fieldPath.split('.').length;
		return depth * 2;
	}

	/**
	 * Check if current line is a valid trigger position
	 * - Must be in frontmatter
	 * - Must be at correct indent level for sub-item
	 * - Must be empty or have partial input
	 */
	static isValidTriggerPosition(cursor: EditorPosition, editor: Editor, expectedFieldPath: string): boolean {
		const context = this.getCurrentFieldPath(cursor, editor);
		if (!context) return false;

		// Check if we're at the right field path
		if (context.path !== expectedFieldPath) return false;

		const line = editor.getLine(cursor.line);
		const fieldName = this.extractFieldName(line);

		// If line has field name, we're at the parent field line
		if (fieldName === expectedFieldPath.split('.').pop()) {
			return true;
		}

		// Otherwise, we should be at a child line with proper indent
		const expectedIndent = this.calculateIndent(expectedFieldPath);
		const actualIndent = this.getIndent(line);

		return actualIndent === expectedIndent;
	}

	/**
	 * Find the line number where a field path starts
	 * For example, find line for "Habits Yestoday.Exercises"
	 */
	private static findFieldLineInEditor(fieldPath: string, editor: Editor, bounds: FrontmatterBounds): number | null {
		const parts = fieldPath.split('.');
		if (parts.length === 0) return null;

		const firstFieldName = parts[0];
		const expectedFirstIndent = 0; // First level has no indent

		// Find the first field
		let currentLine = -1;
		for (let i = bounds.start + 1; i < bounds.end; i++) {
			const line = editor.getLine(i);
			const indent = this.getIndent(line);
			const fieldName = this.extractFieldName(line);

			if (fieldName === firstFieldName && indent === expectedFirstIndent) {
				currentLine = i;
				break;
			}
		}

		if (currentLine === -1) return null;

		// Navigate to nested fields if needed
		for (let partIndex = 1; partIndex < parts.length; partIndex++) {
			const nestedFieldName = parts[partIndex];
			const expectedIndent = partIndex * 2; // Each level adds 2 spaces

			let found = false;
			for (let j = currentLine + 1; j < bounds.end; j++) {
				const line = editor.getLine(j);
				const indent = this.getIndent(line);

				// Stop if we hit a field at lower indent level
				if (indent < expectedIndent && line.trim() !== '') {
					break;
				}

				const fieldName = this.extractFieldName(line);
				if (fieldName === nestedFieldName && indent === expectedIndent) {
					currentLine = j;
					found = true;
					break;
				}
			}

			if (!found) return null;
		}

		return currentLine;
	}
}
