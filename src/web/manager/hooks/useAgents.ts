/**
 * useAgents Hook
 *
 * React Query hook for fetching agents with automatic caching and deduplication.
 * Wraps the api.ts getAgents() function to eliminate duplicate API requests.
 *
 * ## Features
 * - **Automatic Caching**: Shares cached data across all components using this hook
 * - **Request Deduplication**: Multiple simultaneous calls result in a single network request
 * - **Background Refetching**: Automatically keeps data fresh based on staleTime
 * - **Loading/Error States**: Provides isLoading, isError, error states
 * - **Optimistic Updates**: Can be combined with useMutation for instant UI updates
 *
 * ## Usage
 *
 * @example
 * // Basic usage - fetch all agents
 * function AgentsList() {
 *   const { data, isLoading, error } = useAgents();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {data?.map(agent => (
 *         <AgentCard key={agent.id} agent={agent} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * @example
 * // With directory filter
 * function ProjectAgents({ projectPath }: { projectPath: string }) {
 *   const { data, isFetching } = useAgents(projectPath);
 *
 *   return (
 *     <div>
 *       {isFetching && <Spinner />}
 *       <Results agents={data || []} />
 *     </div>
 *   );
 * }
 *
 * @see src/web/manager/services/api.ts for API implementation
 * @see src/web/main.tsx for QueryClient configuration
 */

import { useQuery } from '@tanstack/react-query';
import { getAgents } from '../services/api';
import type { Agent } from '../../../types/agent.types';

/**
 * Fetch agents with React Query caching and deduplication
 *
 * This hook wraps the api.ts getAgents() function with React Query to provide:
 * - Automatic request deduplication (multiple GET /api/strapi/agents calls → 1 call)
 * - Shared cache across all components
 * - Automatic background refetching when data becomes stale
 * - Loading and error state management
 *
 * The query key includes directory to ensure different directories are cached separately.
 * For example, `useAgents('/project1')` and `useAgents('/project2')` will maintain
 * separate cache entries.
 *
 * @param directory - Optional project directory path to filter agents
 * @returns React Query result with data, loading, and error states
 *
 * @example
 * const { data, isLoading, error, refetch } = useAgents('/path/to/project');
 */
export function useAgents(directory?: string) {
  return useQuery<Agent[]>({
    queryKey: ['agents', directory],
    queryFn: () => getAgents(directory),
  });
}
