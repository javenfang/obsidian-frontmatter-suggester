# Frontmatter Suggester Plugin

An intelligent autocomplete plugin for Obsidian that provides context-aware suggestions in YAML frontmatter. Designed specifically for structured data entry like medication tracking, exercise logging, and other hierarchical field management.

## Features

### Intelligent Item Suggestions

**Parent Field Level**
- Shows predefined item options when cursor is on a parent field line
- Example: When cursor is on `Medications:`, suggests medication names like "Aspirin", "Ibuprofen", etc.
- Automatically deduplicates already-added items
- Inserts new item on a new indented line

### Multi-Select Mode

- **Toggle Selection**: Press `Enter` to select/deselect items (checkbox indicators show selection)
- **Batch Insert**: Press `Esc` to insert all selected items at once
- **Visual Feedback**: Shows "(X selected)" count as you make selections
- **Single-Select Fallback**: Fields without multi-select enabled work as traditional single-select dropdowns

Example workflow:
```yaml
Exercises:    # ← Cursor here, suggestions appear
  # Press Enter on "hiking" → [✓] hiking
  # Press Enter on "running" → [✓] running
  # Press Enter on "plank" → [✓] plank (3 selected)
  # Press Esc → Inserts all 3 items
```

### Robust Field Path Detection

- Supports nested YAML structures (e.g., `Daily Habits.Health.Medications`)
- Attempts YAML parsing first for accuracy, falls back to indentation-based heuristic
- Handles mixed language field names
- Works with arbitrary nesting depths

### Case-Sensitive Filtering

- Configurable case sensitivity for suggestion filtering
- Global settings control matching behavior
- Supports Unicode characters and multiple languages

## Configuration

Configuration is stored in the plugin's settings (accessible via Obsidian settings panel under "Frontmatter Suggester").

### Basic Structure

```json
{
  "rules": [
    {
      "id": "unique-uuid",
      "enabled": true,
      "parentField": "Drugs",
      "sourceType": "inline",
      "options": [
        {
          "key": "Atorvastatin",
          "description": "HMG-CoA reductase inhibitor",
          "icon": "💊"
        }
      ],
      "valueConfig": {
        "type": "text",
        "attributes": [
          {
            "name": "time",
            "label": "Medication timing",
            "options": ["Before breakfast", "After breakfast", "Before dinner", "After dinner"],
            "required": false,
            "inputType": "dropdown"
          }
        ]
      }
    }
  ],
  "globalSettings": {
    "minMatchLength": 0,
    "maxSuggestions": 10,
    "caseSensitive": false,
    "autoIndent": true
  }
}
```

### Rule Properties

- **id**: Unique identifier (UUID format)
- **enabled**: Activate/deactivate rule without deletion
- **parentField**: Parent field name (e.g., "Medications", "Daily Habits")
- **childField** (optional): Nested field under parent
- **fieldPath**: Auto-generated from parentField + childField
- **multiSelect**: Enable multi-select mode (default: false)
- **sourceType**: Data source type
  - `inline`: Options defined directly in rule
  - `vault-tags`: All vault tags (TODO)
  - `vault-files`: All vault file names (TODO)
  - `date`: Date picker (TODO)
  - `recent-values`: Recently used values (TODO)
- **options**: Array of `OptionItem` (only for inline sourceType)
- **valueConfig**: Configuration for child item values
- **displayFormat**: Controls icon/description visibility
- **description**: Optional rule description

### OptionItem Structure

```json
{
  "key": "medication-name",
  "description": "Optional description text",
  "icon": "💊"
}
```

### ValueConfig Structure

```json
{
  "type": "number" | "text" | "none",
  "units": [
    {
      "unit": "mg",
      "description": "milligrams"
    }
  ],
  "defaultUnit": "mg",
  "unitBehavior": "optional" | "required" | "none",
  "outputFormat": "simple" | "structured" | "compact"
}
```

**Note**: Attribute suggestions (Case 2) have been removed in favor of simpler field-level suggestions only.

## Usage Examples

### Example 1: Single-Select Mode

**Frontmatter:**
```yaml
---
Medications:
```

**Action:** Position cursor at end of `Medications:` line and trigger suggestions

**Suggestion dropdown shows:**
```
[ ] Aspirin
[ ] Ibuprofen
[ ] Acetaminophen
[ ] Naproxen
```

**Press Enter on "Aspirin":** Immediately inserts
```yaml
---
Medications:
  Aspirin:
```

### Example 2: Multi-Select Mode (Exercises)

**Frontmatter:**
```yaml
---
Exercises:
```

**Action:** Cursor at end of `Exercises:` line, suggestions appear

**Step 1:** Press Enter on "hiking" → `[✓] hiking (1 selected)`
**Step 2:** Press Enter on "running" → `[✓] running (2 selected)`
**Step 3:** Press Enter on "plank" → `[✓] plank (3 selected)`
**Step 4:** Press Esc to confirm

**Result:**
```yaml
---
Exercises:
  hiking:
  running:
  plank:
```

## Architecture

### Field Path Detection

The plugin determines when to show suggestions based on field path matching:

- **ruleDepth** = depth of the rule's fieldPath definition (e.g., "Daily Habits.Exercises" = 2)
- **pathDepth** = current cursor position's field path depth

**Trigger condition (pathDepth === ruleDepth)**: Cursor is at parent field level
- Show item options
- Apply query filtering
- Insert new lines with proper indentation
- Support multi-select if enabled

### Field Path Detection

Uses YAML parsing with fallback:

1. **Primary**: Parse frontmatter as YAML, trust indentation structure
2. **Fallback**: Indentation-based heuristic detection (when YAML parsing fails)

Both methods walk up the indentation hierarchy to determine full path like `Daily Habits.Exercises.hiking`.

### Suggestion Generation Flow

```
onTrigger()
  ↓
[Check: in frontmatter? matching rule? any suggestions?]
  ↓
getSuggestions()
  ↓
generateParentFieldSuggestions()
  ├─ Get existing items
  ├─ Filter by source type
  └─ Dedup against existing
  ↓
filterSuggestions()
  ↓
renderSuggestion()
  ├─ Show checkbox if multiSelect mode
  ├─ Display icon (if configured)
  ├─ Display key
  └─ Show selection count hint
  ↓
selectSuggestion()
  ├─ Single-select: Insert immediately
  └─ Multi-select: Toggle selection
  ↓
close() [on Esc]
  └─ If selections exist: Insert all selected items
```

## Technical Details

### Query Filtering

- Filters suggestions by user's partial input
- Configurable case sensitivity via `globalSettings.caseSensitive`
- Supports Unicode characters and multilingual input

### Item Deduplication

Prevents showing items that are already added to the field:

```typescript
const existingItems = FrontmatterParser.getExistingSubItemsByPath(ruleFieldPath, editor);
// Skip options whose keys are in existingItems
```

### Multi-Select Implementation

- Uses `Set<string>` to track selected item keys
- Enter key toggles selection in multi-select mode
- Esc key triggers batch insertion via overridden `close()` method
- Visual feedback via checkbox indicators and selection count

### Indent Calculation

- Automatic: `depth * 2` spaces (configurable via `autoIndent`)
- Manual: Custom indent via rule's `indent` property

### Performance Optimizations

- Query filtering only applied to Case 1 (unnecessary for Case 2)
- YAML parsing cached in single frontmatter read
- Existing items dedup lookup uses Set-style checking
- Path depth calculation centralized in single helper

## File Structure

```
frontmatter-suggester/
├── main.ts                    # Plugin entry point
├── suggester.ts               # EditorSuggest implementation
├── frontmatter-parser.ts      # YAML/field path detection
├── types.ts                   # TypeScript interfaces
├── settings.ts                # Settings UI tab
├── data.json                  # Default configuration
├── manifest.json              # Plugin metadata
├── styles.css                 # UI styling
├── package.json
└── README.md                  # This file
```

## Development

### Building

```bash
npm install
npm run build
```

### Testing

1. Open Obsidian vault with this plugin enabled
2. Create test note with frontmatter
3. Test Case 1: Add items to parent fields
4. Test Case 2: Add attributes to child items
5. Verify deduplication logic
6. Test with nested fields

### Debug Logging

All console.log statements removed for production. Add debugging by:

```typescript
console.log('Context:', {
  path: fieldContext.path,
  ruleDepth,
  pathDepth,
  suggestions: suggestions.length
});
```

## Known Limitations

- **Single source type**: Currently only `inline` sourceType implemented
- **No array support**: Values must be objects (dicts), not arrays
- **Heuristic fallback**: Indentation-based detection may fail with malformed YAML
- **Edit-only**: Plugin reads frontmatter but doesn't auto-generate it
- **Nested depth**: No hardcoded limit, but performance untested beyond 5 levels
- **Keyboard limitations**: Space key not available for multi-select due to Obsidian EditorSuggest API constraints

## Future Enhancements

1. Implement remaining source types:
   - `vault-tags`: Pull suggestions from all vault tags
   - `vault-files`: Pull file lists for file references
   - `date`: Show date picker
   - `recent-values`: Show recently used values

2. Unit system with conversion helpers

3. Validation rules (min/max, format patterns)

4. Custom formatting templates

5. Auto-completion for entire lines

6. Advanced keyboard shortcuts (if API allows)

## Author

Javen Fang (@javenfang)
javen.out@gmail.com

## License

MIT
