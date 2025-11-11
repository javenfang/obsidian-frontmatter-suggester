# Validation Feature Guide

## Overview

Version 1.3.0 introduces option-level type validation with centered visual feedback.

## Visual Feedback System

### Centered Modal Notifications
When you enter an invalid value and pause typing (500ms debounce), a centered modal appears:
```
┌────────────────────────────────────┐
│ ⚠️ Invalid number format           │
│ 💡 Examples: 10km, 10 km           │
└────────────────────────────────────┘
```

The notification appears for 3 seconds and includes:
- Error description
- Helpful suggestions
- Example values

## Option-Level Validation

### Format
Each option can specify its own type and validation rules:
```
key: type | params
```

### Supported Types

#### 1. Number Type
For numeric values with optional units.

**Format:**
```
key: number | unit1, unit2, ...
key: number  (no units)
```

**Examples:**
```yaml
# Plugin settings:
hiking: number | km
running: number | km, miles
push_ups: number

# In frontmatter:
Exercises:
  hiking: 10km      # ✓ Valid
  running: 5 miles  # ✓ Valid (space allowed)
  push_ups: 50      # ✓ Valid (no unit)
  hiking: 10miles   # ❌ Invalid unit "miles"
  push_ups: 50km    # ❌ No unit expected
```

#### 2. Boolean Type
For yes/no values.

**Format:**
```
key: boolean
```

**Allowed values:** `true`, `false`, `yes`, `no` (case-insensitive)

**Examples:**
```yaml
# Plugin settings:
completed: boolean

# In frontmatter:
Tasks:
  completed: true   # ✓ Valid
  completed: yes    # ✓ Valid
  completed: no     # ✓ Valid
  completed: maybe  # ❌ Invalid boolean value
```

#### 3. Enum Type
For predefined choices.

**Format:**
```
key: enum | value1, value2, value3
```

**Examples:**
```yaml
# Plugin settings:
mood: enum | happy, neutral, sad, tired

# In frontmatter:
Daily:
  mood: happy       # ✓ Valid
  mood: tired       # ✓ Valid
  mood: excited     # ❌ Invalid value (not in enum)
```

## Configuration Example

### Setting Up Options
In Plugin Settings → Edit Rule → Options:

```
hiking: number | km
running: number | km, miles
air_squat: number
wall_sit: number
completed: boolean
mood: enum | happy, sad, tired
```

### Using in Frontmatter
```yaml
---
Habits Yestoday:
  Exercises:
    hiking: 23 km        # ✓ Valid
    running: 5km         # ✓ Valid
    air_squat: 23        # ✓ Valid
    wall_sit: 120        # ✓ Valid
  Status:
    completed: yes       # ✓ Valid
    mood: happy          # ✓ Valid
---
```

## User Experience

### Workflow
1. **Type a value** in frontmatter
2. **Wait 500ms** (debounce delay)
3. **See centered modal** if invalid with error description and suggestions
4. **Fix the error** based on suggestions

### Example Session
```yaml
---
Exercises:
  hiking: abc    ← Type this and wait 500ms
```

**Centered modal appears:**
```
┌────────────────────────────────────┐
│ ⚠️ Invalid number format           │
│ 💡 Examples: 10km, 10 km           │
└────────────────────────────────────┘
```

## Tips

- Validation runs automatically after you stop typing (500ms debounce)
- Modal notifications appear centered on screen for better visibility
- Errors clear automatically when fixed
- Modal notifications disappear after 3 seconds
- Each option can have its own type and validation rules
- Options without type declarations won't trigger validation

## Migration from v1.2.0

### Old Approach (Rule-level)
```json
{
  "valueConfig": {
    "type": "number",
    "units": [{"unit": "km"}, {"unit": "miles"}]
  }
}
```
All options under this rule shared the same units.

### New Approach (Option-level)
```
hiking: number | km
running: number | km, miles
push_ups: number
```
Each option specifies its own type and units.

## Changes in v1.3.0

- **Option-level validation**: Each option can have its own type and parameters
- **Three types supported**: number, boolean, enum
- **Centered modal**: Validation errors now appear in screen center
- **Removed UI sections**: "Value Settings" and "Display Settings" removed (no longer needed)
- **Simplified format**: `key: type | params` format for inline configuration
