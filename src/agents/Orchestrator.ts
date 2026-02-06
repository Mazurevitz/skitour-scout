/**
 * Orchestrator
 *
 * Central coordinator for all agents in SkitourScout.
 * Manages task scheduling, parallel execution, and result aggregation.
 *
 * @module agents/Orchestrator
 */

import { BaseAgent, type AgentContext } from './BaseAgent';
import { WeatherAgent, type WeatherInput } from './WeatherAgent';
import { SafetyAgent, type SafetyInput } from './SafetyAgent';
import type {
  WeatherData,
  AvalancheReport,
  EvaluatedRoute,
  Route,
  AgentResult,
} from '@/types';

/**
 * Orchestrator input - defines what data to fetch
 */
export interface OrchestratorInput {
  /** Location for weather data */
  location?: WeatherInput;
  /** Whether to fetch avalanche report */
  fetchAvalanche?: boolean;
  /** Routes to evaluate */
  routes?: Route[];
}

/**
 * Orchestrator output - aggregated results
 */
export interface OrchestratorOutput {
  /** Weather data if requested */
  weather?: WeatherData;
  /** Avalanche report if requested */
  avalanche?: AvalancheReport | null;
  /** Evaluated routes if provided */
  routes?: EvaluatedRoute[];
  /** Execution summary */
  summary: {
    /** Total execution time */
    totalDuration: number;
    /** Individual agent timings */
    agentTimings: Record<string, number>;
    /** Any errors that occurred */
    errors: string[];
  };
}

/**
 * Orchestrator - coordinates all agents
 */
export class Orchestrator extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  private weatherAgent: WeatherAgent;
  private safetyAgent: SafetyAgent;

  constructor() {
    super({
      id: 'orchestrator',
      name: 'Orchestrator',
      description: 'Coordinates all agents and aggregates results',
    });

    this.weatherAgent = new WeatherAgent();
    this.safetyAgent = new SafetyAgent();
  }

  /**
   * Execute orchestrated data fetching
   */
  protected async executeInternal(
    input: OrchestratorInput,
    context: AgentContext
  ): Promise<OrchestratorOutput> {
    const startTime = Date.now();
    const errors: string[] = [];
    const agentTimings: Record<string, number> = {};

    this.log('Starting orchestrated data fetch');

    // Prepare parallel tasks
    const tasks: Promise<void>[] = [];
    let weatherResult: AgentResult<WeatherData> | undefined;
    let avalancheResult: AgentResult<AvalancheReport | null> | undefined;

    // Weather task
    if (input.location) {
      tasks.push(
        this.weatherAgent.run(input.location, context).then((result) => {
          weatherResult = result;
          agentTimings['weather'] = result.duration;
          if (!result.success && result.error) {
            errors.push(`Weather: ${result.error}`);
          }
        })
      );
    }

    // Avalanche task
    if (input.fetchAvalanche !== false) {
      const safetyInput: SafetyInput = { region: context.region };
      tasks.push(
        this.safetyAgent.run(safetyInput, context).then((result) => {
          avalancheResult = result;
          agentTimings['avalanche'] = result.duration;
          if (!result.success && result.error) {
            errors.push(`Avalanche: ${result.error}`);
          }
        })
      );
    }

    // Execute all tasks in parallel
    await Promise.all(tasks);

    // Evaluate routes if provided
    let evaluatedRoutes: EvaluatedRoute[] | undefined;
    if (input.routes && input.routes.length > 0) {
      const evalStart = Date.now();
      evaluatedRoutes = this.evaluateRoutes(
        input.routes,
        weatherResult?.data,
        avalancheResult?.data ?? undefined
      );
      agentTimings['routeEvaluation'] = Date.now() - evalStart;
    }

    const totalDuration = Date.now() - startTime;
    this.log(`Orchestration complete in ${totalDuration}ms`);

    return {
      weather: weatherResult?.data,
      avalanche: avalancheResult?.data,
      routes: evaluatedRoutes,
      summary: {
        totalDuration,
        agentTimings,
        errors,
      },
    };
  }

  /**
   * Evaluate routes based on current conditions
   */
  private evaluateRoutes(
    routes: Route[],
    weather?: WeatherData,
    avalanche?: AvalancheReport
  ): EvaluatedRoute[] {
    return routes.map((route) => {
      const scores = this.calculateScores(route, weather, avalanche);
      const overallScore = Math.round(
        (scores.weather + scores.avalanche + scores.snowConditions) / 3
      );

      const riskFactors = this.identifyRiskFactors(route, weather, avalanche);
      const recommendation = this.generateRecommendation(route, overallScore, riskFactors, weather, avalanche);

      return {
        ...route,
        conditionScore: overallScore,
        scoreBreakdown: {
          ...scores,
          crowding: 0, // No longer tracked
        },
        recommendation,
        riskFactors,
        optimalTime: this.suggestOptimalTime(route, weather, avalanche),
        evaluatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Calculate individual scores for a route
   * Scores vary based on route characteristics and current conditions
   */
  private calculateScores(
    route: Route,
    weather?: WeatherData,
    avalanche?: AvalancheReport
  ): { weather: number; avalanche: number; snowConditions: number } {
    // Weather score (0-100) - considers route-specific factors
    let weatherScore = 50; // Base score when no data
    if (weather) {
      weatherScore = 50; // Start neutral

      // Condition impact
      if (weather.condition === 'clear') weatherScore += 25;
      else if (weather.condition === 'partly_cloudy') weatherScore += 15;
      else if (weather.condition === 'cloudy') weatherScore += 5;
      else if (weather.condition === 'snow') weatherScore -= 5; // Light snow can be ok
      else if (weather.condition === 'heavy_snow') weatherScore -= 20;
      else if (weather.condition === 'fog') weatherScore -= 25;
      else if (weather.condition === 'rain') weatherScore -= 30;

      // Wind - more impactful at higher altitudes
      const altitudeFactor = Math.min(1.5, route.summit.altitude / 1500);
      if (weather.windSpeed < 10) weatherScore += 15;
      else if (weather.windSpeed < 20) weatherScore += 10;
      else if (weather.windSpeed < 30) weatherScore -= 5 * altitudeFactor;
      else if (weather.windSpeed < 40) weatherScore -= 15 * altitudeFactor;
      else weatherScore -= 25 * altitudeFactor;

      // Visibility
      if (weather.visibility >= 15) weatherScore += 10;
      else if (weather.visibility >= 10) weatherScore += 5;
      else if (weather.visibility < 5) weatherScore -= 10;
      else if (weather.visibility < 2) weatherScore -= 20;

      // Temperature consideration for comfort
      // Very cold (<-15°C) or warm (>5°C) is less ideal
      if (weather.temperature >= -10 && weather.temperature <= 0) {
        weatherScore += 5; // Ideal skiing temps
      } else if (weather.temperature < -15) {
        weatherScore -= 10; // Very cold
      } else if (weather.temperature > 5) {
        weatherScore -= 10; // Warm/wet conditions
      }

      // Freezing level vs route altitude (affects snow quality)
      if (weather.freezingLevel < route.summit.altitude) {
        weatherScore += 5; // Summit is frozen - good
      } else if (weather.freezingLevel > route.summit.altitude + 200) {
        weatherScore -= 10; // Warm at summit - wet snow risk
      }
    }
    weatherScore = Math.max(0, Math.min(100, weatherScore));

    // Avalanche/Safety score (0-100)
    let avalancheScore = 70; // Assume moderate when no data (Beskidy)
    if (avalanche) {
      // Base score decreases with danger level
      avalancheScore = Math.max(0, 100 - (avalanche.level - 1) * 20);

      // Check if route aspects match problem aspects
      const hasProblematicAspect = route.aspects.some((aspect) =>
        avalanche.problemAspects.includes(aspect)
      );
      if (hasProblematicAspect) {
        avalancheScore -= 15;
      }

      // Check altitude
      if (
        route.summit.altitude >= avalanche.altitudeRange.from &&
        route.summit.altitude <= avalanche.altitudeRange.to
      ) {
        avalancheScore -= 10;
      }

      // Steeper routes are riskier
      if (route.difficulty === 'expert') avalancheScore -= 10;
      else if (route.difficulty === 'difficult') avalancheScore -= 5;
    }
    avalancheScore = Math.max(0, Math.min(100, avalancheScore));

    // Snow conditions score - route-specific based on aspect and altitude
    let snowScore = 50; // Unknown when no data
    if (weather) {
      // Base varies by aspect - north-facing holds snow better
      const northFacing = route.aspects.some(a => ['N', 'NE', 'NW'].includes(a));
      const southFacing = route.aspects.some(a => ['S', 'SE', 'SW'].includes(a));

      if (northFacing) {
        snowScore = 65; // North holds powder/quality snow longer
      } else if (southFacing) {
        snowScore = 55; // South gets more sun, variable conditions
      } else {
        snowScore = 60; // East/West - moderate
      }

      // Fresh snow is great (but not too much)
      if (weather.freshSnow24h > 0 && weather.freshSnow24h < 15) {
        snowScore += 20; // Perfect fresh snow
      } else if (weather.freshSnow24h >= 15 && weather.freshSnow24h < 30) {
        snowScore += 10; // Good but settling needed
      } else if (weather.freshSnow24h >= 30) {
        snowScore += 5; // Lots of snow - avalanche concern
      }

      // Snow base depth
      if (weather.snowBase >= 100) snowScore += 10;
      else if (weather.snowBase >= 50) snowScore += 5;
      else if (weather.snowBase < 30) snowScore -= 15; // Not enough base

      // Temperature affects snow quality
      if (weather.temperature < -5) {
        snowScore += 5; // Cold = preserved snow
      } else if (weather.temperature > 3) {
        // Warm temps - bad for north, ok for south (corn potential)
        if (northFacing) snowScore -= 10;
        else if (southFacing) snowScore += 5; // Corn snow potential
      }

      // Higher altitude = generally better snow
      if (route.summit.altitude > 1500) snowScore += 5;
      else if (route.summit.altitude < 1000) snowScore -= 5;
    }
    snowScore = Math.max(0, Math.min(100, snowScore));

    return {
      weather: weatherScore,
      avalanche: avalancheScore,
      snowConditions: snowScore,
    };
  }

  /**
   * Identify risk factors for a route (Polish)
   */
  private identifyRiskFactors(
    route: Route,
    weather?: WeatherData,
    avalanche?: AvalancheReport
  ): string[] {
    const risks: string[] = [];

    if (!avalanche) {
      risks.push('Brak danych lawinowych - sprawdź warunki lokalne');
    } else {
      if (avalanche.level >= 3) {
        risks.push(`Stopień zagrożenia lawinowego: ${avalanche.level}`);
      }
      const hasProblematicAspect = route.aspects.some((a) =>
        avalanche.problemAspects.includes(a)
      );
      if (hasProblematicAspect) {
        risks.push('Trasa przecina problematyczne ekspozycje');
      }
      avalanche.problems.forEach((problem) => risks.push(problem));
    }

    if (!weather) {
      risks.push('Brak danych pogodowych');
    } else {
      if (weather.windSpeed > 40) {
        risks.push('Silny wiatr');
      }
      if (weather.visibility < 2) {
        risks.push('Słaba widoczność');
      }
      if (weather.temperature > 5 && route.summit.altitude < 2000) {
        risks.push('Ciepło - ryzyko mokrych lawin');
      }
    }

    return risks;
  }

  /**
   * Generate recommendation text (Polish)
   */
  private generateRecommendation(
    route: Route,
    score: number,
    riskFactors: string[],
    weather?: WeatherData,
    avalanche?: AvalancheReport
  ): string {
    // If no real data, emphasize uncertainty
    if (!weather && !avalanche) {
      return `Niewystarczające dane dla ${route.name}. Sprawdź warunki lokalne przed wyjściem.`;
    }

    if (score >= 80) {
      return `Warunki wyglądają korzystnie dla ${route.name}.`;
    } else if (score >= 60) {
      return `Umiarkowane warunki. ${riskFactors.length > 0 ? `Uwaga na: ${riskFactors[0]}.` : ''}`;
    } else if (score >= 40) {
      return `Zachowaj ostrożność. ${riskFactors.slice(0, 2).join(', ')}.`;
    } else {
      return `Warunki niezalecane. Ryzyka: ${riskFactors.slice(0, 3).join(', ')}.`;
    }
  }

  /**
   * Suggest optimal time for the route (Polish)
   */
  private suggestOptimalTime(
    route: Route,
    weather?: WeatherData,
    avalanche?: AvalancheReport
  ): string {
    if (!weather && !avalanche) {
      return 'Sprawdź warunki lokalne';
    }

    // Early starts are generally safer for avalanche terrain
    if (avalanche && avalanche.level >= 2) {
      // South-facing slopes: very early to avoid afternoon warming
      if (route.aspects.some((a) => ['S', 'SE', 'SW'].includes(a))) {
        return 'Bardzo wczesny start (przed 6:00) - zjazd przed południem';
      }
      return 'Zalecany wczesny start (6:00-7:00)';
    }

    if (weather && weather.condition === 'clear') {
      return 'Poranny start - najlepsze warunki i widoki';
    }

    return 'Standardowa pora startu odpowiednia';
  }

  /**
   * Get all registered agents
   */
  getAgents(): BaseAgent<unknown, unknown>[] {
    return [this.weatherAgent, this.safetyAgent];
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): BaseAgent<unknown, unknown> | undefined {
    const agents = this.getAgents();
    return agents.find((a) => a.getInfo().id === id);
  }
}
