import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { patientApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, SearchInput, Spinner, EmptyState, ErrorState,
  Pagination, Modal, StatusBadge,
} from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';

function PatientForm({ onSuccess, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const mutation = useMutation({
    mutationFn: patientApi.create,
    onSuccess: () => {
      qc.invalidateQueries(['patients']);
      toast.success('Patient registered successfully');
      onSuccess();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to register patient'),
  });

  const F = ({ label, name, rules, type = 'text', placeholder, children }) => (
    <div>
      <label className="label">{label}</label>
      {children || (
        <input {...register(name, rules)} type={type} placeholder={placeholder} className={clsx('input', errors[name] && 'input-error')} />
      )}
      {errors[name] && <p className="error-msg">{errors[name].message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <F label="First Name *" name="firstName" rules={{ required: 'Required' }} placeholder="John" />
        <F label="Last Name" name="lastName" placeholder="Doe" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Gender *" name="gender" rules={{ required: 'Required' }}>
          <select {...register('gender', { required: 'Required' })} className="input">
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </F>
        <F label="Date of Birth" name="dob" type="date" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Phone *" name="phone" rules={{ required: 'Required' }} placeholder="+91-9000000000" />
        <F label="Email" name="email" type="email" placeholder="patient@email.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Blood Group" name="bloodGroup">
          <select {...register('bloodGroup')} className="input">
            <option value="">Unknown</option>
            {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
        </F>
        <F label="Marital Status" name="maritalStatus">
          <select {...register('maritalStatus')} className="input">
            <option value="">Unknown</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Divorced">Divorced</option>
          </select>
        </F>
      </div>
      <F label="Address" name="address" placeholder="Street, City, State" />
      <div className="grid grid-cols-2 gap-3">
        <F label="Emergency Contact Name" name="emergencyContactName" placeholder="Jane Doe" />
        <F label="Emergency Contact Phone" name="emergencyContactPhone" placeholder="+91-9000000001" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Registering…' : 'Register Patient'}
        </button>
      </div>
    </form>
  );
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const { items, total, page, totalPages, search, isLoading, error, refetch, setPage, handleSearch } = useListQuery('patients', patientApi.list);

  return (
    <div>
      <PageHeader title="Patients" subtitle={`${total} registered patients`}>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" /> Register Patient
        </button>
      </PageHeader>

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={handleSearch} placeholder="Search by name, phone, UHID…" />
          {isLoading && <Spinner />}
        </div>

        {error && <ErrorState message="Failed to load patients" onRetry={refetch} />}

        {!error && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>UHID</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Age</th>
                    <th>Phone</th>
                    <th>Blood Group</th>
                    <th>Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && !isLoading && (
                    <tr><td colSpan={8}><EmptyState title="No patients yet" description="Register your first patient to get started" /></td></tr>
                  )}
                  {items.map((p) => (
                    <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td><span className="font-mono text-xs text-primary-600">{p.uhid}</span></td>
                      <td className="font-medium text-slate-900">{p.firstName} {p.lastName}</td>
                      <td>{p.gender}</td>
                      <td>{p.dob ? getAge(p.dob) + ' yrs' : '—'}</td>
                      <td>{p.phone}</td>
                      <td>{p.bloodGroup ? <span className="badge badge-red">{p.bloodGroup}</span> : '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-slate-400 text-xs">{format(new Date(p.createdAt), 'dd MMM yyyy')}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Register New Patient" size="lg">
        <PatientForm onSuccess={() => setModalOpen(false)} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function getAge(dob) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}
