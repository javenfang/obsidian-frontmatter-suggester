import { OptionItem, ValidationResult } from './types';

/**
 * Validator for option-level validation
 * Each option can have its own type and validation rules
 */
export class OptionValidator {
	/**
	 * Validate a value against an option's configuration
	 */
	static validate(value: string, option: OptionItem): ValidationResult {
		if (!value || value.trim() === '') {
			return { valid: true }; // Empty values are OK
		}

		const trimmedValue = value.trim();

		// If option has no type specified, accept any value
		if (!option.type) {
			return { valid: true };
		}

		switch (option.type) {
			case 'number':
				return this.validateNumber(trimmedValue, option.units);
			case 'boolean':
				return this.validateBoolean(trimmedValue);
			case 'enum':
				return this.validateEnum(trimmedValue, option.enumValues);
			default:
				return { valid: true };
		}
	}

	/**
	 * Validate number type
	 */
	private static validateNumber(value: string, units?: string[]): ValidationResult {
		const parseResult = this.parseNumberWithUnit(value);

		if (!parseResult) {
			return {
				valid: false,
				error: 'Invalid number format',
				suggestion: this.getNumberSuggestion(units)
			};
		}

		const { unit } = parseResult;

		// Check unit validity
		if (units && units.length > 0) {
			// Units are defined - must have a valid unit
			if (!unit) {
				return {
					valid: false,
					error: 'Unit required',
					suggestion: `Valid units: ${units.join(', ')}`
				};
			}

			if (!units.includes(unit)) {
				return {
					valid: false,
					error: `Invalid unit "${unit}"`,
					suggestion: `Valid units: ${units.join(', ')}`
				};
			}
		} else {
			// No units defined - should be plain number
			if (unit) {
				return {
					valid: false,
					error: 'No unit expected',
					suggestion: 'Enter plain number'
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Validate boolean type
	 */
	private static validateBoolean(value: string): ValidationResult {
		const lowerValue = value.toLowerCase();
		const validValues = ['true', 'false', 'yes', 'no'];

		if (!validValues.includes(lowerValue)) {
			return {
				valid: false,
				error: 'Invalid boolean value',
				suggestion: 'Valid: true, false, yes, no'
			};
		}

		return { valid: true };
	}

	/**
	 * Validate enum type
	 */
	private static validateEnum(value: string, enumValues?: string[]): ValidationResult {
		if (!enumValues || enumValues.length === 0) {
			return { valid: true }; // No enum values defined
		}

		if (!enumValues.includes(value)) {
			return {
				valid: false,
				error: 'Invalid value',
				suggestion: `Valid: ${enumValues.join(', ')}`
			};
		}

		return { valid: true };
	}

	/**
	 * Parse number with optional unit
	 * Examples: "10", "10.5", "10km", "10 km"
	 */
	private static parseNumberWithUnit(value: string): { numValue: number; unit?: string } | null {
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
	 * Get suggestion for number format
	 */
	private static getNumberSuggestion(units?: string[]): string {
		if (units && units.length > 0) {
			const exampleUnit = units[0];
			return `Examples: 10${exampleUnit}, 10 ${exampleUnit}`;
		}
		return 'Examples: 10, 10.5';
	}
}
