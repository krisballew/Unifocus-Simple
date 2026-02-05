/**
 * LLM Compiler Service
 * Orchestrates the process of compiling compliance text into rule packages
 * Uses LLM to extract rules, validates them, and creates rule packages
 */

import { LLMClient } from '../services/llm-client';

import {
  RULE_COMPILER_SYSTEM_PROMPT,
  buildCompileRulesUserPrompt,
  buildClarifyRuleUserPrompt,
  buildReviewRulePackagePrompt,
} from './prompt-templates';
import { type CompiledRuleWithParams } from './types';

export interface CompileComplianceTextResult {
  success: boolean;
  ruleJson?: {
    rules: CompiledRuleWithParams[];
  };
  error?: string;
  tokensUsed?: number;
  warnings?: string[];
}

export interface ComplianceCompilationInput {
  complianceText: string;
  context?: string;
  includeReview?: boolean;
  maxTokens?: number;
}

/**
 * Compliance Compiler Service
 */
export class ComplianceCompiler {
  private llmClient: LLMClient;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient || new LLMClient();
  }

  /**
   * Compile compliance text into a rule package
   * Main entry point for rule extraction and compilation
   */
  async compileComplianceText(
    input: ComplianceCompilationInput
  ): Promise<CompileComplianceTextResult> {
    const { complianceText, context, includeReview = true, maxTokens = 4096 } = input;

    if (!complianceText || complianceText.trim().length === 0) {
      return {
        success: false,
        error: 'Compliance text is required',
      };
    }

    if (complianceText.length > 10000) {
      return {
        success: false,
        error:
          'Compliance text too long (max 10,000 characters). Please provide a summary or split into multiple parts.',
      };
    }

    const warnings: string[] = [];
    let totalTokensUsed = 0;

    try {
      // Step 1: Extract rules using LLM
      const userPrompt = buildCompileRulesUserPrompt(complianceText, context);

      const extractionResult = await this.llmClient.complete({
        systemPrompt: RULE_COMPILER_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.3, // Lower temperature for more consistent output
        maxTokens,
      });

      totalTokensUsed += extractionResult.tokensUsed || 0;

      // Step 2: Parse the LLM output as JSON
      let ruleData;
      try {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = extractionResult.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            success: false,
            error:
              'LLM did not return valid JSON. Response: ' +
              extractionResult.content.substring(0, 200),
          };
        }

        ruleData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        return {
          success: false,
          error:
            'Failed to parse LLM response as JSON: ' +
            (parseError instanceof Error ? parseError.message : 'Unknown error'),
        };
      }

      // Step 3: Validate the rule data structure
      if (!ruleData.rules || !Array.isArray(ruleData.rules)) {
        return {
          success: false,
          error: 'Invalid rule structure: expected array of rules',
        };
      }

      if (ruleData.rules.length === 0) {
        warnings.push('No rules were extracted from the provided text');
      }

      // Step 4: Validate each rule
      const validatedRules: CompiledRuleWithParams[] = [];
      for (const rule of ruleData.rules) {
        if (!rule.ruleId || !rule.name) {
          warnings.push(`Skipping invalid rule: missing ruleId or name`);
          continue;
        }

        // Normalize the rule
        const normalized: CompiledRuleWithParams = {
          ruleId: rule.ruleId,
          name: rule.name,
          description: rule.description || '',
          enabled: rule.enabled !== false, // Default to enabled
          severity: rule.severity === 'WARN' ? 'WARN' : 'ERROR',
          params: rule.params || {},
          citations: rule.citations,
          clarifications: rule.clarifications,
        };

        validatedRules.push(normalized);
      }

      // Step 5: Optional review of the rule package
      if (includeReview && validatedRules.length > 0) {
        const reviewPrompt = buildReviewRulePackagePrompt(
          complianceText,
          JSON.stringify(ruleData, null, 2)
        );

        try {
          const reviewResult = await this.llmClient.complete({
            systemPrompt: 'You are a labor compliance expert reviewing extracted rules.',
            userPrompt: reviewPrompt,
            temperature: 0.5,
            maxTokens: 1000,
          });

          totalTokensUsed += reviewResult.tokensUsed || 0;

          if (reviewResult.content.toLowerCase().includes('missing')) {
            warnings.push(
              'Review noted potential missing rules: ' + reviewResult.content.substring(0, 100)
            );
          }
        } catch (reviewError) {
          warnings.push(
            'Rule review failed (non-blocking): ' +
              (reviewError instanceof Error ? reviewError.message : 'Unknown error')
          );
        }
      }

      return {
        success: true,
        ruleJson: {
          rules: validatedRules,
        },
        tokensUsed: totalTokensUsed,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Compilation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  }

  /**
   * Get clarification for a rule
   * Helps explain how to apply a rule
   */
  async clarifyRule(
    ruleName: string,
    ruleDescription: string,
    sourceText?: string
  ): Promise<string> {
    const userPrompt = buildClarifyRuleUserPrompt(ruleName, ruleDescription, sourceText);

    const result = await this.llmClient.complete({
      systemPrompt:
        'You are a labor compliance expert explaining how to apply rules in payroll systems.',
      userPrompt,
      temperature: 0.5,
      maxTokens: 500,
    });

    return result.content;
  }

  /**
   * Validate rule parameters
   */
  async validateRuleParams(
    ruleName: string,
    ruleDescription: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const userPrompt = `
Rule: ${ruleName}
Description: ${ruleDescription}

Parameters:
${JSON.stringify(params, null, 2)}

Are these parameters valid? Respond with only "yes" or "no".
`;

    const result = await this.llmClient.complete({
      systemPrompt: 'You are a labor compliance expert. Validate rule parameters.',
      userPrompt,
      temperature: 0,
      maxTokens: 10,
    });

    return result.content.toLowerCase().includes('yes');
  }

  /**
   * Batch compile multiple compliance documents
   */
  async batchCompile(
    documents: Array<{ text: string; context?: string }>
  ): Promise<CompileComplianceTextResult[]> {
    const results: CompileComplianceTextResult[] = [];

    for (const doc of documents) {
      const result = await this.compileComplianceText({
        complianceText: doc.text,
        context: doc.context,
      });

      results.push(result);

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }
}

/**
 * Create a singleton compiler instance
 */
let compilerInstance: ComplianceCompiler | null = null;

export function getComplianceCompiler(llmClient?: LLMClient): ComplianceCompiler {
  if (!compilerInstance) {
    compilerInstance = new ComplianceCompiler(llmClient);
  }
  return compilerInstance;
}

/**
 * Create a new compiler instance
 */
export function createComplianceCompiler(llmClient?: LLMClient): ComplianceCompiler {
  return new ComplianceCompiler(llmClient);
}
