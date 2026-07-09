import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { labApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, SearchInput, Spinner, EmptyState,
  ErrorState, Pagination, Modal, StatusBadge,
} from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// Dedicated test-creation API call (POST /lab/tests)
function createLabTest(data) {
  return import('../../api/index.js').then(({ default: api }) =>
    api.post('/lab/tests', data)
  );
}

export default function LabTestsPage() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();
  const {
    items, total, page, totalPages, search,
    isLoading, error, refetch, setPage, handleSearch,
  } = useListQuery('lab-tests', labApi.listTests);

  const { data: categories } = useQuery({
    queryKey: ['lab-categories'],
    queryFn: () => labApi.listTests({ limit: 1 })
      .then(() => import('../../api/index.js').then(({ default: api }) =>
        api.get('/lab/categories').then(r => r.data.data)
      )),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const create = useMutation({
    mutationFn: createLabTest,
    onSuccess: () => {
      qc.invalidateQueries(['lab-tests']);
      toast.success('Lab test added to catalog');
      setModal(false);
      reset();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add test'),
  });

  return (
    <div>
      <PageHeader title="Lab Test Catalog" subtitle={`${total} tests configured`}>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Test
        </button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search test name, code…" />
          {isLoading && <Spinner />}
        </div>

        {error && <ErrorState message="Failed to load lab tests" onRetry={refetch} />}
        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Sample Type</th>
                    <th>Price</th>
                    <th>TAT (hrs)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading && (
                    <tr><td colSpan={7}>
                      <EmptyState
                        title="No tests in catalog"
                        description="Add lab tests to start accepting orders"
                      />
                    </td></tr>
                  )}
                  {items.map(t => (
                    <tr key={t.id}>
                      <td>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {t.testCode || '—'}
                        </span>
                      </td>
                      <td className="font-medium text-slate-900">{t.testName}</td>
                      <td>
                        {t.category?.categoryName
                          ? <span className="badge badge-blue">{t.category.categoryName}</span>
                          : '—'}
                      </td>
                      <td className="text-sm text-slate-500">{t.sampleType || '—'}</td>
                      <td className="font-medium">
                        {t.price ? `₹${Number(t.price).toLocaleString()}` : '—'}
                      </td>
                      <td>{t.turnaroundHours ?? '—'}</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Lab Test" size="md">
        <form
          onSubmit={handleSubmit(d => create.mutate({
            ...d,
            categoryId: d.categoryId ? Number(d.categoryId) : null,
            price: d.price ? Number(d.price) : null,
            turnaroundHours: d.turnaroundHours ? Number(d.turnaroundHours) : null,
          }))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Test Name *</label>
              <input
                {...register('testName', { required: 'Test name is required' })}
                className={clsx('input', errors.testName && 'input-error')}
                placeholder="e.g. Complete Blood Count"
              />
              {errors.testName && <p className="error-msg">{errors.testName.message}</p>}
            </div>

            <div>
              <label className="label">Test Code</label>
              <input
                {...register('testCode')}
                className="input"
                placeholder="e.g. CBC"
              />
            </div>

            <div>
              <label className="label">Category</label>
              <select {...register('categoryId')} className="input">
                <option value="">None</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.categoryName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Sample Type</label>
              <select {...register('sampleType')} className="input">
                <option value="">Select</option>
                {['Blood','Urine','Stool','Sputum','Swab','CSF','Biopsy','Other'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Price (₹) *</label>
              <input
                {...register('price', { required: 'Price is required' })}
                type="number"
                step="0.01"
                className={clsx('input', errors.price && 'input-error')}
                placeholder="0.00"
              />
              {errors.price && <p className="error-msg">{errors.price.message}</p>}
            </div>

            <div>
              <label className="label">Turnaround Time (hours)</label>
              <input
                {...register('turnaroundHours')}
                type="number"
                className="input"
                placeholder="e.g. 4"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={create.isPending} className="btn-primary">
              {create.isPending ? 'Adding…' : 'Add Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
