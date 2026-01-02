/**
 * useFlows Hook
 *
 * React Query hook for fetching flows with automatic caching and deduplication.
 * Wraps the flow-api.ts getFlows() function to eliminate duplicate API requests.
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
 * // Basic usage - fetch all flows
 * function FlowsList() {
 *   const { data, isLoading, error } = useFlows();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {data.data.map(flow => (
 *         <FlowCard key={flow.id} flow={flow} />
 *       ))}
 *     </div>
 *   );
 * }
 *
 * @example
 * // With filters and pagination
 * function ActiveFlows() {
 *   const { data } = useFlows({
 *     isActive: true,
 *     status: 'published',
 *     page: 1,
 *     pageSize: 20
 *   });
 *
 *   return <FlowsList flows={data?.data || []} />;
 * }
 *
 * @example
 * // With search
 * function FlowSearch({ searchTerm }: { searchTerm: string }) {
 *   const { data, isFetching } = useFlows({
 *     search: searchTerm
 *   });
 *
 *   return (
 *     <div>
 *       {isFetching && <Spinner />}
 *       <Results flows={data?.data || []} />
 *     </div>
 *   );
 * }
 *
 * @see src/web/manager/services/flow-api.ts for API implementation
 * @see src/web/main.tsx for QueryClient configuration
 */

import { useQuery } from '@tanstack/react-query';
import { getFlows, type FlowQueryParams, type FlowListResponse } from '../services/flow-api';

/**
 * Fetch flows with React Query caching and deduplication
 *
 * This hook wraps the flow-api.ts getFlows() function with React Query to provide:
 * - Automatic request deduplication (9x GET /api/flows calls → 1 call)
 * - Shared cache across all components
 * - Automatic background refetching when data becomes stale
 * - Loading and error state management
 *
 * The query key includes params to ensure different filter combinations are cached separately.
 * For example, `useFlows({ isActive: true })` and `useFlows({ status: 'draft' })` will
 * maintain separate cache entries.
 *
 * @param params - Optional query parameters for filtering, pagination, and sorting
 * @returns React Query result with data, loading, and error states
 *
 * @example
 * const { data, isLoading, error, refetch } = useFlows({ status: 'published' });
 */
export function useFlows(params?: FlowQueryParams) {
  return useQuery<FlowListResponse>({
    queryKey: ['flows', params],
    queryFn: () => getFlows(params),
  });
}
