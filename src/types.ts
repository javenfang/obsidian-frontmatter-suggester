// Data models for the plugin

export interface PluginSettings {
	rules: FieldRule[];
	globalSettings: GlobalSettings;
}

export interface FieldRule {
	id: string;                    // Unique identifier (UUID)
	enabled: boolean;              // Whether this rule is active
	parentField: string;           // Parent field name (e.g., "Habits Yestoday")
	childField?: string;           // Child field name (optional, e.g., "Exercises")
	fieldPath?: string;            // Auto-generated: parentField.childField or just parentField
	sourceType: SourceType;        // Data source type
	options?: OptionItem[];        // Inline options (when sourceType = 'inline')
	displayFormat?: DisplayFormat; // Display format configuration
	indent?: number;               // Custom indent (optional, default auto-calculated)
	description?: string;          // Rule description
	multiSelect?: boolean;         // Enable multi-select mode (default: false)
}

export type SourceType =
	| 'inline'        // Defined directly in settings
	| 'vault-tags'    // All vault tags
	| 'vault-files'   // Vault file list
	| 'date'          // Date picker
	| 'recent-values' // Recently used values

export interface OptionItem {
	key: string;                        // Required: the key to insert
	description?: string;               // Optional: description text
	icon?: string;                      // Optional: emoji icon
	type?: 'number' | 'boolean' | 'enum'; // Value type for validation
	units?: string[];                   // For number: allowed units (empty = no unit)
	enumValues?: string[];              // For enum: allowed values
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	suggestion?: string;
}

export interface DisplayFormat {
	showDescription: boolean;  // Whether to show description text
	showIcon: boolean;         // Whether to show icon
}

export interface GlobalSettings {
	minMatchLength: number;     // Minimum match characters (0-3)
	maxSuggestions: number;     // Maximum suggestions
	caseSensitive: boolean;     // Case sensitive matching
	autoIndent: boolean;        // Auto-calculate indent
}

// Suggestion item structure
export interface SuggestionItem {
	rule: FieldRule;
	option: OptionItem;
	displayText: string;
	insertText: string;
}

// Frontmatter bounds
export interface FrontmatterBounds {
	start: number;  // Start line number (inclusive)
	end: number;    // End line number (inclusive)
}

// Field path context
export interface FieldPathContext {
	path: string;      // Full path, e.g., "Habits Yestoday.Exercises"
	line: number;      // Current line number
	indent: number;    // Current indent level
	value?: any;       // The actual YAML value at this path
}

// Default settings
export const DEFAULT_SETTINGS: PluginSettings = {
	rules: [],
	globalSettings: {
		minMatchLength: 0,
		maxSuggestions: 10,
		caseSensitive: false,
		autoIndent: true
	}
};
