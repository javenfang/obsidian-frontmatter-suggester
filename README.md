# Frontmatter Suggester

An Obsidian plugin that provides smart autocomplete suggestions when filling out your note properties (YAML frontmatter). Perfect for tracking daily habits, exercise routines, medication logs, or any structured information.

## What does it do?

When you're filling out properties at the top of your notes, this plugin suggests items from pre-configured lists as you type. It saves you from having to remember exact names or typing them repeatedly.

**Example:** You have a daily exercise log. Instead of typing "hiking", "running", "push_ups" every day, just trigger the autocomplete and select from your list.

## Why use standardized frontmatter?

**For habit tracking and data analysis:** Consistent field names and formats are essential for querying your data with Dataview.

When you track habits with standardized frontmatter:
- Same field names every day → Easy to query across all notes
- Validated values → Reliable statistics and charts
- Structured format → Works seamlessly with Dataview queries

**Example:** With consistent `Exercises.hiking` entries, you can easily create queries like:
- Total hiking distance this month
- Average daily exercise count
- Habits completion trends

Without standardized format, Dataview queries become unreliable or impossible.

## Key Features

### 🎯 Smart Suggestions
- Autocomplete appears when you need it
- Only shows items you haven't already added
- Works with nested properties

### ✅ Multi-Select Mode
- Select multiple items at once
- Press `Enter` to check items
- Press `Esc` to add all selected items

### 🔢 Value Validation
- Set up rules for numbers (with units like "km", "miles")
- Validate yes/no values
- Restrict to specific choices (enum)
- Get instant feedback when values don't match rules

### 🌍 Unicode Support
- Works with any language
- Handles Chinese, Japanese, Korean, etc.

## How to Use

### Basic Setup

1. Open Settings → Frontmatter Suggester
2. Click "Add New Rule"
3. Fill in the form:

```
┌─────────────────────────────────────┐
│ Parent Field: Exercises             │
│ Child Field: (leave empty)          │
│ Multi-Select: ☑ Enabled             │
│                                      │
│ Options (one per line):              │
│ ┌─────────────────────────────────┐ │
│ │ hiking: number | km              │ │
│ │ running: number | km, miles      │ │
│ │ push_ups: number                 │ │
│ │ plank: number                    │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Save]  [Cancel]                    │
└─────────────────────────────────────┘
```

4. Click Save

### Using in Your Notes

**In your note:**
```yaml
---
Exercises:    ← Put cursor here
---
```

**Autocomplete appears:**
```
☐ hiking
☐ running
☐ push_ups
☐ plank
```

**Select multiple items:**
- Press `Enter` on "hiking" → ☑ hiking (1 selected)
- Press `Enter` on "running" → ☑ running (2 selected)
- Press `Esc` to confirm

**Result:**
```yaml
---
Exercises:
  hiking:
  running:
---
```

Now you can fill in the values (e.g., "hiking: 10km").

## Value Validation

You can add validation rules to ensure values are entered correctly.

### Number with Units

**Setup:**
```
hiking: number | km
running: number | km, miles
push_ups: number
```

**Valid values:**
- `hiking: 10km` ✓
- `hiking: 10 km` ✓ (space allowed)
- `running: 5 miles` ✓
- `push_ups: 50` ✓ (no unit)

**Invalid values:**
- `hiking: 10miles` ✗ (wrong unit)
- `push_ups: 50km` ✗ (unexpected unit)
- `hiking: abc` ✗ (not a number)

### Yes/No Values

**Setup:**
```
completed: boolean
```

**Valid values:**
- `true`, `false`, `yes`, `no` (case-insensitive)

### Fixed Choices

**Setup:**
```
mood: enum | happy, neutral, sad, tired
```

**Valid values:**
- Must be exactly one of: happy, neutral, sad, tired

### Validation Feedback

When you enter an invalid value and pause typing, a centered notification appears:

```
┌────────────────────────────────────┐
│ ⚠️ Invalid unit "miles"            │
│ 💡 Valid units: km                 │
└────────────────────────────────────┘
```

The notification disappears after 3 seconds.

## Real-World Examples

### Daily Habit Tracking

**Rule setup:**
```
Parent Field: Habits Yesterday
Child Field: Exercises
Options:
  hiking: number | km
  running: number | km
  wall_sit: number
  air_squat: number
  plank: number
```

**In your daily note:**
```yaml
---
Habits Yesterday:
  Exercises:    ← Trigger autocomplete here
    hiking: 10km
    air_squat: 50
---
```

### Medication Log

**Rule setup:**
```
Parent Field: Medications
Options:
  aspirin: number | mg
  ibuprofen: number | mg
  vitamin_d: number | IU
```

**Usage:**
```yaml
---
Medications:
  aspirin: 81mg
  vitamin_d: 2000IU
---
```

### Project Tags

**Rule setup:**
```
Parent Field: Tags
Options:
  work
  personal
  urgent
  review
```

**Usage:**
```yaml
---
Tags:
  work:
  urgent:
---
```

## Settings

### Global Settings

```
┌─────────────────────────────────────────┐
│ Minimum Match Length: 0                  │
│ (Start suggesting after N characters)    │
│                                           │
│ Maximum Suggestions: 10                  │
│ (How many items to show at once)         │
│                                           │
│ Case Sensitive: ☐                        │
│ (Match exact case when filtering)        │
│                                           │
│ Auto Indent: ☑                           │
│ (Calculate indentation automatically)    │
└─────────────────────────────────────────┘
```

### Per-Rule Settings

- **Parent Field**: Top-level property name
- **Child Field**: Optional nested property
- **Multi-Select**: Allow selecting multiple items at once
- **Description**: Optional note about what this rule is for

## Tips

### Nested Properties

You can create suggestions for nested structures:

```yaml
---
Daily:
  Morning:     ← Rule for "Daily.Morning"
    exercise:
    meditation:
  Evening:     ← Rule for "Daily.Evening"
    reading:
    journal:
---
```

Set up two rules:
- Parent: `Daily`, Child: `Morning`
- Parent: `Daily`, Child: `Evening`

### No Type Declaration

Options without type declarations won't trigger validation:

```
simple_note
another_note
no_validation_here
```

Use this when you just want autocomplete without validation.

### Mixed Format

You can mix validated and non-validated options:

```
hiking: number | km
running: number | km
stretching
meditation
```

## Troubleshooting

### Autocomplete doesn't appear
- Make sure cursor is at the end of the field line
- Check that field name matches your rule exactly
- Verify the rule is enabled in settings

### Wrong indentation
- Enable "Auto Indent" in global settings
- Check your YAML syntax (proper spacing matters)

### Validation not working
- Make sure you've specified a type: `key: type | params`
- Check that the format is correct (no extra spaces around `:` and `|`)

### Items not deduplicating
- Plugin only dedups items already added under the same parent
- Check for exact name matches (case-sensitive)

## Technical Notes

- Uses Obsidian's EditorSuggest API
- YAML parsing with indentation fallback
- Real-time validation with 500ms debounce
- Works with any valid YAML frontmatter structure

## Development

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Output: main.js
```

## Version History

**v1.3.0** - Option-level type validation
- Each option can have its own validation rules
- Three types supported: number, boolean, enum
- Centered modal notifications
- Removed legacy UI sections

**v1.2.0** - Multi-select support
- Batch item insertion
- Value validation system

**v1.0.0** - Initial release
- Basic autocomplete
- Nested field support

## Author

Javen Fang ([@javenfang](https://github.com/javenfang))

## License

MIT
