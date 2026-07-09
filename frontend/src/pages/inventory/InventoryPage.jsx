import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Package, AlertTriangle, ShoppingCart, TrendingDown } from 'lucide-react';
import { inventoryApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import { PageHeader, Spinner, EmptyState, ErrorState, Pagination, Modal } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

const PO_STATUS_COLORS = { Draft:'bg-slate-100 text-slate-600', Sent:'bg-blue-100 text-blue-700', PartiallyReceived:'bg-yellow-100 text-yellow-700', Received:'bg-green-100 text-green-700', Cancelled:'bg-red-100 text-red-700' };

export default function InventoryPage() {
  const [tab, setTab] = useState('items');
  const [modal, setModal] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['inventory-stats'], queryFn: () => inventoryApi.stats().then(r => r.data.data) });
  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter } = useListQuery('inventory-items', inventoryApi.listItems);
  const { items: pos, total: poTotal, page: poPage, totalPages: poTotalPages, isLoading: poLoading, setPage: setPoPage } = useListQuery('purchase-orders', inventoryApi.listPOs);
  const { data: categories } = useQuery({ queryKey: ['inventory-categories'], queryFn: () => inventoryApi.listCategories({ limit: 200 }).then(r => r.data.data) });
  const { data: lowStockData } = useQuery({ queryKey: ['low-stock'], queryFn: () => inventoryApi.lowStock().then(r => r.data.data) });

  const { register, handleSubmit, reset, watch } = useForm();

  const createItem = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => { qc.invalidateQueries(['inventory-items','inventory-stats']); toast.success('Item added'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const createPO = useMutation({
    mutationFn: inventoryApi.createPO,
    onSuccess: () => { qc.invalidateQueries(['purchase-orders','inventory-stats']); toast.success('Purchase order created'); setModal(null); reset(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const receivePO = useMutation({
    mutationFn: ({ id, data }) => inventoryApi.receivePO(id, data),
    onSuccess: () => { qc.invalidateQueries(['purchase-orders','inventory-items','inventory-stats']); toast.success('Stock received'); setSelectedPO(null); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const cats = categories?.items || [];

  return (
    <div>
      <PageHeader title="Inventory & Stores" subtitle={`${total} items`}>
        <button onClick={() => { reset(); setModal('po'); }} className="btn-secondary"><ShoppingCart className="w-4 h-4" /> Purchase Order</button>
        <button onClick={() => { reset(); setModal('item'); }} className="btn-primary"><Package className="w-4 h-4" /> Add Item</button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3"><Package className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats?.totalItems ?? '—'}</p><p className="text-xs text-slate-500">Total Items</p></div></div>
        <div className="card p-4 flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-red-500" /><div><p className="text-2xl font-bold">{stats?.lowStockCount ?? '—'}</p><p className="text-xs text-slate-500">Low Stock</p></div></div>
        <div className="card p-4 flex items-center gap-3"><ShoppingCart className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{stats?.totalPOs ?? '—'}</p><p className="text-xs text-slate-500">Purchase Orders</p></div></div>
        <div className="card p-4 flex items-center gap-3"><TrendingDown className="w-8 h-8 text-orange-500" /><div><p className="text-2xl font-bold">{stats?.pendingPOs ?? '—'}</p><p className="text-xs text-slate-500">Pending POs</p></div></div>
      </div>

      {/* Low stock alert */}
      {Array.isArray(lowStockData) && lowStockData.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2"><AlertTriangle className="w-4 h-4" /> {lowStockData.length} items below minimum stock level</div>
          <div className="flex flex-wrap gap-2">
            {lowStockData.slice(0,8).map(i => (
              <span key={i.id} className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">{i.name}: {Number(i.current_stock).toFixed(0)} {i.unit}</span>
            ))}
            {lowStockData.length > 8 && <span className="text-red-500 text-xs py-1">+{lowStockData.length - 8} more</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['items','purchase-orders'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t.replace('-',' ')}</button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="card">
          <div className="card-header flex items-center gap-3">
            <select onChange={e => updateFilter('categoryId', e.target.value)} className="input w-auto text-sm">
              <option value="">All Categories</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isLoading && <Spinner />}
          </div>
          {error && <ErrorState message="Failed to load items" onRetry={refetch} />}
          {!error && (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Stock</th><th>Min Level</th><th>Unit</th><th>Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {items.length === 0 && !isLoading && <tr><td colSpan={8}><EmptyState title="No items" description="Add inventory items to get started" /></td></tr>}
                    {items.map(i => {
                      const isLow = Number(i.currentStock) <= Number(i.minStockLevel);
                      return (
                        <tr key={i.id}>
                          <td className="font-mono text-xs">{i.itemCode}</td>
                          <td className="font-medium text-slate-900">{i.name}</td>
                          <td className="text-sm">{i.category?.name || '—'}</td>
                          <td className={`font-bold text-sm ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{Number(i.currentStock).toFixed(0)}</td>
                          <td className="text-sm text-slate-500">{Number(i.minStockLevel).toFixed(0)}</td>
                          <td className="text-sm">{i.unit}</td>
                          <td className="text-sm">₹{Number(i.unitPrice).toFixed(2)}</td>
                          <td>{isLow ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" /> Low</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">OK</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
            </>
          )}
        </div>
      )}

      {tab === 'purchase-orders' && (
        <div className="card">
          {poLoading && <div className="p-8 text-center"><Spinner /></div>}
          {!poLoading && (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Expected</th><th>Total</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {pos.length === 0 && <tr><td colSpan={7}><EmptyState title="No purchase orders" description="Create a purchase order to get started" /></td></tr>}
                    {pos.map(po => (
                      <tr key={po.id}>
                        <td className="font-mono text-sm">{po.poNumber}</td>
                        <td className="text-sm">{po.supplier?.supplierName || '—'}</td>
                        <td className="text-sm">{new Date(po.orderDate).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="font-medium">₹{Number(po.totalAmount).toLocaleString()}</td>
                        <td><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PO_STATUS_COLORS[po.status]}`}>{po.status}</span></td>
                        <td>
                          {['Sent','PartiallyReceived'].includes(po.status) && (
                            <button className="btn-primary btn-sm" onClick={() => setSelectedPO(po)}>Receive</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-4"><Pagination page={poPage} totalPages={poTotalPages} onPageChange={setPoPage} /></div>
            </>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal open={modal === 'item'} onClose={() => setModal(null)} title="Add Inventory Item" size="md">
        <form onSubmit={handleSubmit(d => createItem.mutate({ ...d, categoryId: d.categoryId ? Number(d.categoryId) : undefined, minStockLevel: parseFloat(d.minStockLevel) || 0, unitPrice: parseFloat(d.unitPrice) || 0 }))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Item Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div><label className="label">Category</label>
              <select {...register('categoryId')} className="input">
                <option value="">Select</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Unit *</label><input {...register('unit', { required: true })} className="input" placeholder="e.g. pcs, kg, L" /></div>
            <div><label className="label">Min Stock Level</label><input {...register('minStockLevel')} type="number" step="0.01" className="input" defaultValue={10} /></div>
            <div><label className="label">Unit Price (₹)</label><input {...register('unitPrice')} type="number" step="0.01" className="input" defaultValue={0} /></div>
            <div><label className="label">Location</label><input {...register('location')} className="input" placeholder="Shelf/Rack" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createItem.isPending} className="btn-primary">Add Item</button>
          </div>
        </form>
      </Modal>

      {/* Create PO Modal */}
      <Modal open={modal === 'po'} onClose={() => setModal(null)} title="Create Purchase Order" size="md">
        <form onSubmit={handleSubmit(d => createPO.mutate({ ...d, orderDate: d.orderDate || new Date().toISOString().split('T')[0], items: [{ itemId: Number(d.itemId), orderedQty: parseFloat(d.orderedQty), unitPrice: parseFloat(d.unitPrice) }] }))}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Order Date *</label><input {...register('orderDate', { required: true })} type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} /></div>
            <div><label className="label">Expected Date</label><input {...register('expectedDate')} type="date" className="input" /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea {...register('notes')} className="input" rows={2} /></div>
            <div className="col-span-2 border-t pt-3"><p className="text-sm font-medium text-slate-700 mb-2">First Item</p></div>
            <div className="col-span-2"><label className="label">Item ID *</label><input {...register('itemId', { required: true })} type="number" className="input" /></div>
            <div><label className="label">Quantity *</label><input {...register('orderedQty', { required: true })} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Unit Price (₹) *</label><input {...register('unitPrice', { required: true })} type="number" step="0.01" className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createPO.isPending} className="btn-primary">Create PO</button>
          </div>
        </form>
      </Modal>

      {/* Receive PO Modal */}
      <Modal open={!!selectedPO} onClose={() => setSelectedPO(null)} title={`Receive PO: ${selectedPO?.poNumber}`} size="md">
        {selectedPO && (
          <div>
            <div className="space-y-3 mb-4">
              {selectedPO.items?.map((item, idx) => (
                <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-sm font-medium">{item.item?.name}</p>
                  <p className="text-xs text-slate-500">Ordered: {Number(item.orderedQty)} | Received: {Number(item.receivedQty)}</p>
                  <div className="mt-2"><label className="label">Receiving Qty</label>
                    <input id={`recv-qty-${idx}`} type="number" step="0.01" className="input" defaultValue={Number(item.orderedQty) - Number(item.receivedQty)} />
                    <input type="hidden" id={`recv-item-id-${idx}`} value={item.id} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedPO(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => {
                const items = selectedPO.items?.map((item, idx) => ({ itemId: item.id.toString(), qty: parseFloat(document.getElementById(`recv-qty-${idx}`).value) || 0 }));
                receivePO.mutate({ id: selectedPO.id, data: { items } });
              }} disabled={receivePO.isPending} className="btn-primary">Confirm Receipt</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
