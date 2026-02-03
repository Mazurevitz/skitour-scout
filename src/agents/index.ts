/**
 * Agent System Exports
 *
 * Central export point for all agents in SkitourScout.
 *
 * @module agents
 */

// Base agent
export { BaseAgent, type AgentConfig, type AgentContext } from './BaseAgent';
export { createAgentResult, createErrorResult } from './BaseAgent';

// Individual agents
export { WeatherAgent, type WeatherInput } from './WeatherAgent';
export { SafetyAgent, type SafetyInput } from './SafetyAgent';
export {
  WebSearchAgent,
  type WebSearchInput,
  type ConditionReport,
  type SearchResult,
} from './WebSearchAgent';
export {
  SocialIntelAgent,
  type SocialIntelInput,
  type StructuredIntel,
} from './SocialIntelAgent';

// Orchestrator
export {
  Orchestrator,
  type OrchestratorInput,
  type OrchestratorOutput,
} from './Orchestrator';
