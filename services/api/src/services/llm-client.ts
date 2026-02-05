/**
 * LLM Client Service
 * Wrapper around OpenAI API for LLM operations
 * Abstracts LLM calls to a single service for easy testing and swapping
 */

export interface LLMCompletionParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMCompletionResult {
  content: string;
  tokensUsed?: number;
  model?: string;
}

export interface LLMCompileRulesParams {
  complianceText: string;
  ruleTemplates?: string;
  maxTokens?: number;
}

export interface LLMCompileRulesResult {
  jsonRulePack: string; // JSON string of rule pack
  tokensUsed?: number;
}

/**
 * LLM Client for interacting with OpenAI API
 */
export class LLMClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4-turbo';

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required. Set it in environment variables.');
    }
  }

  /**
   * Make a raw completion call to OpenAI
   */
  async complete(params: LLMCompletionParams): Promise<LLMCompletionResult> {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.7,
      maxTokens = 2000,
      model = this.model,
    } = params;

    try {
      // Import OpenAI dynamically to allow for graceful degradation if not installed
      // eslint-disable-next-line import/no-unresolved
      const { OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: this.apiKey,
      });

      const response = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens;

      return {
        content,
        tokensUsed,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM completion failed: ${error.message}`);
      }
      throw new Error('LLM completion failed: Unknown error');
    }
  }

  /**
   * Compile compliance text into rule pack JSON
   * Uses LLM to parse and structure CBA/compliance text
   */
  async compileRules(params: LLMCompileRulesParams): Promise<LLMCompileRulesResult> {
    const { complianceText, ruleTemplates, maxTokens = 4096 } = params;

    // Build user prompt for rule compilation
    let userPrompt = `Extract compliance rules from the following text and convert to JSON format:\n\n${complianceText}`;

    if (ruleTemplates) {
      userPrompt += `\n\nUse this JSON structure for each rule:\n${ruleTemplates}`;
    }

    // System prompt for rule compilation
    const systemPrompt = `You are a labor compliance expert. Convert the provided compliance text (CBAs, policies, regulations) into structured JSON rules.

Output ONLY valid JSON in this format:
{
  "rules": [
    {
      "ruleId": "RULE_NAME_IN_UPPERCASE",
      "name": "Human readable rule name",
      "description": "What this rule enforces",
      "severity": "ERROR" or "WARN",
      "params": { /* rule-specific parameters */ },
      "citations": [
        {
          "sourceText": "Exact quote from source",
          "section": "Section reference if available",
          "lineNumber": actual line number or null
        }
      ]
    }
  ]
}

Be thorough in extracting all compliance rules mentioned in the text.`;

    try {
      const result = await this.complete({
        systemPrompt,
        userPrompt,
        temperature: 0.3, // Lower temperature for more deterministic output
        maxTokens,
      });

      // Validate that result is valid JSON
      try {
        JSON.parse(result.content);
      } catch (_error) {
        throw new Error('LLM returned invalid JSON: ' + result.content.substring(0, 200));
      }

      return {
        jsonRulePack: result.content,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Rule compilation failed: ${error.message}`);
      }
      throw new Error('Rule compilation failed: Unknown error');
    }
  }

  /**
   * Generate clarifications for a rule
   * Helps explain complex rule requirements
   */
  async clarifyRule(
    ruleName: string,
    ruleDescription: string,
    sourceText?: string
  ): Promise<string> {
    const userPrompt = `
Rule: ${ruleName}
Description: ${ruleDescription}
${sourceText ? `Source Text:\n${sourceText}` : ''}

Provide a brief, clear explanation of how to apply this rule in a scheduling/timecard system.
Focus on practical implementation details.
Keep to 2-3 sentences.
`;

    const systemPrompt = `You are a labor compliance expert.
Provide clear, practical explanations for how compliance rules should be applied.
Focus on actionable guidance for payroll and scheduling systems.`;

    const result = await this.complete({
      systemPrompt,
      userPrompt,
      temperature: 0.5,
      maxTokens: 500,
    });

    return result.content;
  }

  /**
   * Validate rule parameters against a rule definition
   * Ensures compiled rules have valid parameters
   */
  async validateRuleParams(
    ruleDefinition: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const userPrompt = `
Rule Definition:
${ruleDefinition}

Parameters to validate:
${JSON.stringify(params, null, 2)}

Are these parameters valid for this rule? Respond with only "true" or "false".
`;

    const systemPrompt = `You are a labor compliance expert.
Validate whether the given parameters are appropriate for the given rule.
Respond with only true or false.`;

    const result = await this.complete({
      systemPrompt,
      userPrompt,
      temperature: 0,
      maxTokens: 10,
    });

    return result.content.toLowerCase().includes('true');
  }
}

/**
 * Create a singleton LLM client instance
 */
let llmClientInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new LLMClient();
  }
  return llmClientInstance;
}

/**
 * Create a new LLM client instance
 */
export function createLLMClient(apiKey?: string, model?: string): LLMClient {
  return new LLMClient(apiKey, model);
}
