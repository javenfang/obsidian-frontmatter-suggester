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
	valueConfig?: ValueConfig;     // Value configuration
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

export interface ValueConfig {
	type: 'number' | 'text' | 'none';  // Value type
	units?: UnitConfig[];               // Optional unit list
	defaultUnit?: string;               // Default unit (empty string or undefined means no default unit)
	unitBehavior?: 'optional' | 'required' | 'none'; // Unit behavior
	outputFormat?: 'simple' | 'structured' | 'compact'; // Output format
	validation?: ValidationConfig;      // Validation rules
}

export interface ValidationConfig {
	// For number type
	min?: number;              // Minimum value (inclusive)
	max?: number;              // Maximum value (inclusive)
	allowDecimal?: boolean;    // Allow decimal numbers (default: true)

	// For text type
	minLength?: number;        // Minimum string length
	maxLength?: number;        // Maximum string length
	pattern?: string;          // Regular expression pattern

	// Common
	required?: boolean;        // Whether value is required (default: false)
	customErrorMessage?: string; // Custom error message
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	suggestion?: string;
}

export interface UnitConfig {
	unit: string;         // Unit name, e.g., "km", "g", "ml"
	description?: string; // Unit description
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
