/* MetricFlow — erro do Pathfind ("login recusado", "sessão expirada", "sem simulação", "tela do Pathfind mudou (…)"). */
import { ColetaError } from "../checknow/repo";

export class PathfindError extends ColetaError {}
