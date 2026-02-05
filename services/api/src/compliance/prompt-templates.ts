/**
 * Prompt templates for LLM-based rule compilation
 * Defines system and user prompts for various compliance tasks
 */

/**
 * System prompt for the rule compiler
 * Instructs the LLM how to convert compliance text to JSON rules
 */
export const RULE_COMPILER_SYSTEM_PROMPT = `You are an expert labor law and compliance consultant. Your task is to extract rules from compliance documents (CBAs, employment policies, labor regulations) and convert them to structured JSON format.

## Output Format

You MUST output ONLY valid JSON matching this structure:
\`\`\`json
{
  "rules": [
    {
      "ruleId": "RULE_ID_IN_CAPS_WITH_UNDERSCORES",
      "name": "Human-readable rule name",
      "description": "Clear description of what this rule enforces",
      "severity": "ERROR|WARN",
      "params": {
        "paramName": "example value with type hints"
      },
      "citations": [
        {
          "sourceText": "Exact quote from the source document",
          "section": "Section number or title if available",
          "lineNumber": 42
        }
      ],
      "clarifications": [
        {
          "clarification": "Implementation note or explanation",
          "context": "When this applies"
        }
      ]
    }
  ]
}
\`\`\`

## Important Guidelines

1. **Rule IDs**: Use SCREAMING_SNAKE_CASE. Be descriptive: MIN_REST_BETWEEN_SHIFTS, MEAL_BREAK_REQUIRED, etc.
2. **Severity**: Use ERROR for violations that are illegal/must be fixed. Use WARN for best practices/recommendations.
3. **Parameters**: Extract all configurable aspects of the rule as parameters. Examples:
   - \`minimumRestHours\`: 11
   - \`mealBreakMinutes\`: 30
   - \`overtimeThreshold\`: 40
4. **Citations**: Include exact quotes and references to support each rule.
5. **Completeness**: Extract ALL rules mentioned in the document, no matter how small.
6. **Accuracy**: Do not invent rules. Only extract from provided text.

## Examples

For "Employees must have 11 hours rest between shifts", output:
\`\`\`json
{
  "ruleId": "MIN_REST_BETWEEN_SHIFTS",
  "name": "Minimum Rest Between Shifts",
  "description": "Employees must have minimum rest period between shifts",
  "severity": "ERROR",
  "params": {
    "minimumRestHours": 11
  },
  "citations": [{
    "sourceText": "Employees must have 11 hours rest between shifts",
    "section": "Section 2.1"
  }]
}
\`\`\`

For "Employees working 5+ hours should take a 30-minute break", output:
\`\`\`json
{
  "ruleId": "MEAL_BREAK_RECOMMENDED",
  "name": "Meal Break Recommended",
  "description": "Employees working long shifts should take meal breaks",
  "severity": "WARN",
  "params": {
    "minimumShiftHours": 5,
    "breakMinutes": 30
  },
  "citations": [{
    "sourceText": "Employees working 5+ hours should take a 30-minute break",
    "section": "Best Practices"
  }]
}
\`\`\`
`;

/**
 * Build the user prompt for rule compilation
 */
export function buildCompileRulesUserPrompt(complianceText: string, context?: string): string {
  let prompt = `Please extract all compliance rules from the following text:\n\n${complianceText}`;

  if (context) {
    prompt += `\n\nContext: ${context}`;
  }

  prompt += `\n\nOutput the rules as a JSON object with a "rules" array containing all extracted rules.`;

  return prompt;
}

/**
 * System prompt for rule clarification
 */
export const RULE_CLARIFICATION_SYSTEM_PROMPT = `You are a labor compliance expert helping implement compliance rules in a scheduling and timecard system.

Your task is to provide clear, practical explanations of how to apply a specific compliance rule.

Focus on:
1. What data needs to be checked
2. How to calculate whether the rule is violated
3. What the remediation looks like
4. Any edge cases or special considerations

Keep explanations concise but complete (2-4 sentences).`;

/**
 * Build the user prompt for rule clarification
 */
export function buildClarifyRuleUserPrompt(
  ruleName: string,
  ruleDescription: string,
  sourceText?: string
): string {
  let prompt = `
Rule Name: ${ruleName}
Description: ${ruleDescription}
`;

  if (sourceText) {
    prompt += `
Source Document Text:
${sourceText}
`;
  }

  prompt += `
Please provide:
1. How to check if this rule is violated
2. What remediation should look like
3. Any important edge cases

Keep it practical for a payroll/scheduling system.
`;

  return prompt;
}

/**
 * System prompt for rule validation
 */
export const RULE_VALIDATION_SYSTEM_PROMPT = `You are a labor law compliance expert. 
Your task is to validate whether a set of rule parameters makes sense for a given rule definition.

Respond with only: "valid" or "invalid"
Then on the next line, provide a brief explanation (1 sentence).

Consider:
- Are all required parameters present?
- Are parameter values within reasonable ranges?
- Do parameters make logical sense together?
`;

/**
 * Build prompt for rule parameter validation
 */
export function buildValidateRuleParamsPrompt(
  ruleName: string,
  ruleDescription: string,
  params: Record<string, unknown>
): string {
  return `
Rule: ${ruleName}
Description: ${ruleDescription}

Parameters:
${JSON.stringify(params, null, 2)}

Are these parameters valid for this rule?
`;
}

/**
 * System prompt for rule package review
 */
export const RULE_PACKAGE_REVIEW_SYSTEM_PROMPT = `You are a labor compliance expert reviewing a compiled set of rules.

Your task is to identify:
1. Missing rules that should have been included
2. Conflicting rules
3. Rules that are unclear or ambiguous

Be thorough but concise.`;

/**
 * Build prompt for rule package review
 */
export function buildReviewRulePackagePrompt(sourceText: string, rulePackageJson: string): string {
  return `
Source Document:
${sourceText}

Compiled Rule Package:
${rulePackageJson}

Please review this rule package for:
1. Completeness: Are all material rules from the source captured?
2. Accuracy: Do the extracted rules accurately reflect the source?
3. Conflicts: Are there any contradictory rules?
4. Ambiguities: Are any rules unclear or ambiguous?

Provide a brief assessment (3-5 sentences).
`;
}

/**
 * Templates for different rule categories
 */
export const RULE_CATEGORY_TEMPLATES = {
  workHours: {
    name: 'Work Hours & Rest Periods',
    examples: [
      'MIN_REST_BETWEEN_SHIFTS',
      'MAX_CONSECUTIVE_HOURS',
      'DAILY_OVERTIME',
      'WORK_WEEK_REST_DAY',
    ],
  },
  breaks: {
    name: 'Breaks & Meal Periods',
    examples: ['MEAL_BREAK_REQUIRED', 'BREAK_TIMING', 'BREAK_PAID_STATUS'],
  },
  compensation: {
    name: 'Compensation & Pay',
    examples: ['OVERTIME_PAY_RATE', 'MINIMUM_WAGE', 'HOLIDAY_PAY', 'SHIFT_DIFFERENTIAL'],
  },
  staffing: {
    name: 'Staffing & Scheduling',
    examples: ['MINIMUM_STAFFING_LEVELS', 'NO_SPLIT_SHIFTS', 'SCHEDULE_POSTING_NOTICE'],
  },
  discrimination: {
    name: 'Non-Discrimination & Equity',
    examples: ['EQUAL_PAY_FOR_EQUAL_WORK', 'NO_RETALIATION'],
  },
};
