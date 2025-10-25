---
type: contract-review
status: in_progress
feature: Enemy Stat Refactoring
author: Claude Code
date: 2025-10-24

# API Contract and Style Inheritance Investigation

## Brainstormed Flaws

### API Response Structure
- Potential inconsistency in how normalized vs. realized enemy stats are returned
- Risk of breaking client-side parsing of enemy stats
- Possible ambiguity in zone hit information representation

### Style Inheritance Concerns
- Unclear mechanism for handling edge cases where enemy has no style
- Potential race conditions in style propagation during loot generation
- Lack of explicit validation for style_id matching between enemy and material

### Error Handling
- Missing detailed error responses for zone-based combat mechanics
- No explicit handling for impossible zone hit scenarios
- Lack of comprehensive validation for enemy stat computation

### Data Integrity
- No clear constraint on normalized stat distribution (must sum to 1.0)
- Potential floating-point precision issues in stat calculations
- Missing documentation on stat scaling behavior

## Verification Results

### MaterialStack Style Propagation
- Confirmed robust style_id tracking mechanism
- Composite primary key supports (user_id, material_id, style_id)
- Style inheritance follows clear flow:
  1. MaterialStack tracks user-specific styles
  2. MaterialInstance preserves style information
  3. Dynamic style name fetching during transformations

### API Contract Validation
- CombatRewards schema already includes style_id
- Zone hit information matches specified structure
- Enemy response includes both normalized and realized stats
- No applied_loot_pools field in updated schema

### Stat Calculation Mechanics
- Stat scaling formula matches plan:
  - base_atk = atk_power_normalized × 8 × combat_level × difficulty_multiplier × 10
  - HP scales only with tier difficulty_multiplier

## Critical Issues

1. **Implicit Style Normalization**
   - No explicit handling for 'normal' style_id default
   - Potential inconsistent behavior when style is not specified

2. **Zone Hit Probability Distribution**
   - Lack of explicit validation for zone probability calculation
   - Potential statistical bias in zone hit simulation

3. **Performance Overhead**
   - Complex style and stat inheritance may introduce computational complexity
   - Dynamic style name fetching could impact response times

## Recommendations

1. Add explicit type guards and validation for:
   - Normalized stat distribution (sum == 1.0)
   - Style_id default and propagation rules
   - Zone hit probability generation

2. Implement comprehensive error responses for:
   - Invalid stat computations
   - Style inheritance edge cases
   - Zone hit simulation failures

3. Consider adding database-level constraints:
   - Enforce normalized stat distribution
   - Create explicit style inheritance rules

4. Performance optimization:
   - Memoize style name lookups
   - Pre-compute zone probability distributions
   - Add caching layer for repeated computations

## Next Steps
- Validate implementation against this investigation
- Write comprehensive test coverage
- Update API documentation to clarify mechanics