import { ValueConfig, ValidationResult, UnitConfig } from './types';

export class ValueValidator {
	/**
	 * Validate a value against the value configuration
	 */
	static validate(value: string, config: ValueConfig): ValidationResult {
		// Empty value validation
		if (!value || value.trim() === '') {
			if (config.validation?.required) {
				return {
					valid: false,
					error: config.validation.customErrorMessage || 'Value is required'
				};
			}
			// Empty is OK if not required
			return { valid: true };
		}

		const trimmedValue = value.trim();

		// Type-specific validation
		switch (config.type) {
			case 'number':
				return this.validateNumber(trimmedValue, config);
			case 'text':
				return this.validateText(trimmedValue, config);
			case 'none':
				return { valid: true };
			default:
				return { valid: true };
		}
	}

	/**
	 * Validate number type value
	 */
	private static validateNumber(value: string, config: ValueConfig): ValidationResult {
		// Parse number and unit
		const parseResult = this.parseNumberWithUnit(value, config.units);

		if (!parseResult) {
			return {
				valid: false,
				error: 'Invalid number format',
				suggestion: this.getNumberFormatSuggestion(config)
			};
		}

		const { numValue, unit } = parseResult;

		// Check if decimal is allowed
		if (config.validation?.allowDecimal === false && !Number.isInteger(numValue)) {
			return {
				valid: false,
				error: 'Decimal numbers are not allowed',
				suggestion: 'Please enter an integer value'
			};
		}

		// Check min/max
		if (config.validation?.min !== undefined && numValue < config.validation.min) {
			return {
				valid: false,
				error: `Value must be at least ${config.validation.min}`,
				suggestion: `Enter a value >= ${config.validation.min}`
			};
		}

		if (config.validation?.max !== undefined && numValue > config.validation.max) {
			return {
				valid: false,
				error: `Value must be at most ${config.validation.max}`,
				suggestion: `Enter a value <= ${config.validation.max}`
			};
		}

		// Validate unit if present
		if (unit) {
			const validUnits = (config.units || []).map(u => u.unit);
			if (validUnits.length > 0 && !validUnits.includes(unit)) {
				return {
					valid: false,
					error: `Invalid unit "${unit}"`,
					suggestion: `Valid units: ${validUnits.join(', ')}`
				};
			}
		} else {
			// No unit provided
			if (config.unitBehavior === 'required' && (config.units || []).length > 0) {
				const validUnits = (config.units || []).map(u => u.unit);
				return {
					valid: false,
					error: 'Unit is required',
					suggestion: `Add a unit: ${validUnits.join(', ')}`
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Validate text type value
	 */
	private static validateText(value: string, config: ValueConfig): ValidationResult {
		// Min length
		if (config.validation?.minLength !== undefined && value.length < config.validation.minLength) {
			return {
				valid: false,
				error: `Text must be at least ${config.validation.minLength} characters`,
				suggestion: `Current length: ${value.length}`
			};
		}

		// Max length
		if (config.validation?.maxLength !== undefined && value.length > config.validation.maxLength) {
			return {
				valid: false,
				error: `Text must be at most ${config.validation.maxLength} characters`,
				suggestion: `Current length: ${value.length}`
			};
		}

		// Pattern matching
		if (config.validation?.pattern) {
			try {
				const regex = new RegExp(config.validation.pattern);
				if (!regex.test(value)) {
					return {
						valid: false,
						error: config.validation.customErrorMessage || 'Value does not match required pattern',
						suggestion: `Pattern: ${config.validation.pattern}`
					};
				}
			} catch (e) {
				// Invalid regex pattern in config - skip validation
				console.error('Invalid regex pattern in validation config:', e);
			}
		}

		return { valid: true };
	}

	/**
	 * Parse a number with optional unit
	 * Examples: "10", "10.5", "10km", "10.5 km", "10 g"
	 */
	private static parseNumberWithUnit(
		value: string,
		units?: UnitConfig[]
	): { numValue: number; unit?: string } | null {
		// Try to match: number + optional whitespace + optional unit
		const match = value.match(/^([-+]?\d+\.?\d*)\s*(.*)$/);
		if (!match) {
			return null;
		}

		const numPart = match[1];
		const unitPart = match[2].trim();

		const numValue = parseFloat(numPart);
		if (isNaN(numValue)) {
			return null;
		}

		return {
			numValue,
			unit: unitPart || undefined
		};
	}

	/**
	 * Get suggestion for number format based on config
	 */
	private static getNumberFormatSuggestion(config: ValueConfig): string {
		const examples: string[] = [];

		if (config.units && config.units.length > 0) {
			const exampleUnit = config.defaultUnit || config.units[0].unit;
			examples.push(`10${exampleUnit}`);
			examples.push(`10 ${exampleUnit}`);
		} else {
			examples.push('10');
			if (config.validation?.allowDecimal !== false) {
				examples.push('10.5');
			}
		}

		return `Examples: ${examples.join(', ')}`;
	}

	/**
	 * Create a user-friendly error message for display
	 */
	static formatErrorMessage(result: ValidationResult): string {
		if (result.valid) {
			return '';
		}

		let message = result.error || 'Invalid value';
		if (result.suggestion) {
			message += ` (${result.suggestion})`;
		}

		return message;
	}
}
