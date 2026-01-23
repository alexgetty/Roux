# ValidationProvider

Data integrity and schema enforcement.

## Overview

ValidationProvider ensures data quality. It validates node structure, enforces constraints, checks link integrity, and applies custom rules before data is persisted.

## Interface

```typescript
interface ValidationProvider {
  // Schema validation
  validateNode(node: Node, schema?: Schema): ValidationResult;

  // Constraint checking
  checkConstraints(node: Node): ConstraintResult;

  // Link integrity
  validateLinks(node: Node, existingNodes: Set<string>): LinkValidationResult;

  // Custom rules
  applyRules(node: Node, rules: ValidationRule[]): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface Schema {
  requiredFields: string[];
  propertyTypes: Record<string, PropertyType>;
  allowAdditionalProperties: boolean;
}
```

## Validation Types

**Schema Validation**
- Required fields present
- Property types correct
- No unexpected properties (if strict)

**Constraint Checking**
- Unique ID enforcement
- Required relationships
- Property value constraints

**Link Integrity**
- All outgoing links resolve to existing nodes
- No circular self-references (if disallowed)
- Bidirectional link consistency

**Custom Rules**
- Domain-specific validation
- Business logic constraints
- Cross-node validation

## When Validation Runs

- Before `createNode` commits
- Before `updateNode` commits
- During batch import
- On-demand integrity checks

## Error Handling

Validation failures can:
1. **Block operation** — Strict mode, nothing commits
2. **Warn and proceed** — Log issue, commit anyway
3. **Auto-fix** — Correct common issues automatically

## Related

- [[GraphCore]] — Invokes validation before writes
- [[StoreProvider]] — Receives only validated nodes
- [[IngestionProvider]] — Validated before batch import
- [[Node]] — The data being validated
