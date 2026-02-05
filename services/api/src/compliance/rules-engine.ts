/**
 * Labor compliance rules engine
 * Evaluates compiled rule packages against canonical worked days
 * Pure functions - no LLM calls at evaluation time
 */

import {
  type RuleContext,
  type RuleEvaluator,
  type RulePackageEvaluationResult,
  type ComplianceViolation,
  type CompiledRuleWithParams,
} from './types';

/**
 * Evaluates a single rule against context
 */
export async function evaluateRule(
  rule: RuleEvaluator,
  context: RuleContext,
  ruleParams?: Record<string, unknown>
): Promise<ComplianceViolation[]> {
  // Create context with rule parameters if provided
  const contextWithParams = ruleParams ? { ...context, ruleParams } : context;

  try {
    const violations = await rule.evaluate(contextWithParams as RuleContext);
    return violations;
  } catch (error) {
    console.error(`Error evaluating rule ${rule.ruleId}:`, error);
    return [];
  }
}

/**
 * Evaluates a rule package with compiled rules and returns all violations
 */
export async function evaluateRulePackage(params: {
  rulePackageId: string;
  compiledRules: CompiledRuleWithParams[];
  ruleImplementations: Map<string, RuleEvaluator>;
  context: RuleContext;
}): Promise<RulePackageEvaluationResult> {
  const { rulePackageId, compiledRules, ruleImplementations, context } = params;

  const allViolations: ComplianceViolation[] = [];

  // Evaluate each rule in the package
  for (const compiledRule of compiledRules) {
    // Skip disabled rules
    if (!compiledRule.enabled) {
      continue;
    }

    // Get the rule implementation
    const ruleImpl = ruleImplementations.get(compiledRule.ruleId);
    if (!ruleImpl) {
      console.warn(`Rule implementation not found: ${compiledRule.ruleId}`);
      continue;
    }

    // Validate rule parameters if validator is available
    if (ruleImpl.validateParams && !ruleImpl.validateParams(compiledRule.params)) {
      console.warn(`Invalid parameters for rule ${compiledRule.ruleId}`);
      continue;
    }

    // Evaluate the rule
    const violations = await evaluateRule(ruleImpl, context, compiledRule.params);

    // Add citations and severity override from compiled rule
    for (const violation of violations) {
      if (!violation.citation && compiledRule.citations && compiledRule.citations.length > 0) {
        violation.citation = compiledRule.citations[0];
      }

      // Use severity from compiled rule
      violation.severity = compiledRule.severity;
    }

    allViolations.push(...violations);
  }

  // Build result
  const hasErrors = allViolations.some((v) => v.severity === 'ERROR');
  const hasWarnings = allViolations.some((v) => v.severity === 'WARN');

  return {
    rulePackageId,
    violations: allViolations,
    hasErrors,
    hasWarnings,
  };
}

/**
 * Creates a rules engine with registered rules
 */
export function createRulesEngine() {
  const registeredRules = new Map<string, RuleEvaluator>();

  return {
    /**
     * Register a rule implementation
     */
    registerRule(rule: RuleEvaluator): void {
      registeredRules.set(rule.ruleId, rule);
    },

    /**
     * Register multiple rules
     */
    registerRules(rules: RuleEvaluator[]): void {
      for (const rule of rules) {
        this.registerRule(rule);
      }
    },

    /**
     * Get a registered rule
     */
    getRule(ruleId: string): RuleEvaluator | undefined {
      return registeredRules.get(ruleId);
    },

    /**
     * Get all registered rules
     */
    getAllRules(): RuleEvaluator[] {
      return Array.from(registeredRules.values());
    },

    /**
     * Evaluate a rule package
     */
    async evaluate(params: {
      rulePackageId: string;
      compiledRules: CompiledRuleWithParams[];
      context: RuleContext;
    }): Promise<RulePackageEvaluationResult> {
      return evaluateRulePackage({
        ...params,
        ruleImplementations: registeredRules,
      });
    },
  };
}

/**
 * Type for rules engine
 */
export type RulesEngine = ReturnType<typeof createRulesEngine>;
