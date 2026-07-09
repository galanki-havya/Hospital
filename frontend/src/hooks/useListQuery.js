import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Standard hook for any paginated list endpoint.
 * @param {string|string[]} queryKey - React Query key (appended with params)
 * @param {function} fetchFn - (params) => Promise<axios response>
 * @param {object} initialFilters - extra filter state beyond page/limit/search
 */
export function useListQuery(queryKey, fetchFn, initialFilters = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const limit = 20;

  const params = { page, limit, search: search || undefined, ...filters };

  const query = useQuery({
    queryKey: Array.isArray(queryKey) ? [...queryKey, params] : [queryKey, params],
    queryFn: () => fetchFn(params).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const totalPages = query.data?.meta?.pagination?.totalPages ?? 1;
  const total = query.data?.meta?.pagination?.total ?? 0;
  const items = query.data?.data ?? [];

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  }

  function handleSearch(val) {
    setSearch(val);
    setPage(1);
  }

  return {
    items,
    total,
    page,
    totalPages,
    search,
    filters,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    setPage,
    handleSearch,
    updateFilter,
    setFilters,
  };
}
