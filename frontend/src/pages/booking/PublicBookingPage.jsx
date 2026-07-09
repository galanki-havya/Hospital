import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CalendarDays, CheckCircle, Clock, User, Phone, Mail, Stethoscope } from 'lucide-react';
import { publicBookingApi } from '../../api/index.js';
import { Spinner } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';

export default function PublicBookingPage() {
  const { slug } = useParams();
  const [step, setStep] = useState(1); // 1=select doctor, 2=patient details, 3=success
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-booking', slug],
    queryFn: () => publicBookingApi.getHospital(slug).then(r => r.data.data),
    retry: false,
  });

  const book = useMutation({
    mutationFn: (formData) => publicBookingApi.book(slug, formData),
    onSuccess: (res) => { setConfirmation(res.data.data); setStep(3); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Booking failed. Please try again.'),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center"><Spinner /><p className="text-slate-500 mt-2">Loading...</p></div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="card p-8 text-center max-w-md">
        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Booking Page Not Found</h2>
        <p className="text-slate-500 text-sm">The booking link may have expired or is incorrect. Please contact the hospital for assistance.</p>
      </div>
    </div>
  );

  const { hospital, doctors = [], config } = data;

  const generateTimeSlots = () => {
    const slots = [];
    for (let h = config.startHour; h < config.endHour; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      if (config.slotDuration <= 30) slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  };

  const onSubmit = (formData) => {
    book.mutate({
      ...formData,
      doctorId: selectedDoctor.id,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6 text-center">
        {hospital.logo && <img src={hospital.logo} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-3" />}
        <h1 className="text-2xl font-bold text-slate-900">{hospital.name}</h1>
        {hospital.address && <p className="text-sm text-slate-500 mt-1">{hospital.address}</p>}
        {hospital.phone && <p className="text-sm text-slate-500">{hospital.phone}</p>}
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center gap-2">
          {['Select Doctor', 'Your Details', 'Confirmed'].map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}>
                {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === i + 1 ? 'text-primary-700' : 'text-slate-400'}`}>{label}</span>
              {i < 2 && <div className={`flex-1 h-px ${step > i + 1 ? 'bg-green-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Step 1: Select Doctor */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Select a Doctor</h2>
              {doctors.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">No doctors available for online booking.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctors.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDoctor(doc); setStep(2); }}
                    className={`text-left p-4 rounded-xl border-2 transition-all hover:border-primary-400 hover:shadow-md ${selectedDoctor?.id === doc.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">Dr. {doc.firstName} {doc.lastName}</p>
                        <p className="text-xs text-slate-500">{doc.specialization}</p>
                        {doc.consultationFee && <p className="text-xs text-primary-600 font-medium mt-0.5">₹{Number(doc.consultationFee).toLocaleString()}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Patient Details */}
        {step === 2 && (
          <div className="card p-6">
            <button onClick={() => setStep(1)} className="text-xs text-slate-400 mb-4 hover:text-slate-600">← Back to doctor selection</button>

            {selectedDoctor && (
              <div className="bg-primary-50 rounded-lg p-3 mb-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-900">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                  <p className="text-xs text-primary-600">{selectedDoctor.specialization}</p>
                </div>
              </div>
            )}

            <h2 className="font-semibold text-slate-900 mb-4">Your Details</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input {...register('firstName', { required: 'First name required' })} className="input" />
                  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input {...register('lastName')} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input {...register('phone', { required: 'Phone required', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit mobile number' } })} className="input pl-9" placeholder="9876543210" />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input {...register('email')} type="email" className="input pl-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date of Birth</label>
                  <input {...register('dob')} type="date" className="input" />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select {...register('gender')} className="input">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Preferred Date *</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...register('appointmentDate', { required: 'Date required' })}
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="input pl-9"
                  />
                </div>
                {errors.appointmentDate && <p className="text-xs text-red-500 mt-1">{errors.appointmentDate.message}</p>}
              </div>
              <div>
                <label className="label">Preferred Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select {...register('appointmentTime')} className="input pl-9">
                    {generateTimeSlots().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason for Visit</label>
                <textarea {...register('notes')} className="input" rows={2} placeholder="Brief description of your symptoms or reason for visit" />
              </div>
              <button type="submit" disabled={book.isPending} className="btn-primary w-full text-base py-3">
                {book.isPending ? <><Spinner className="w-4 h-4" /> Booking...</> : 'Confirm Appointment'}
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && confirmation && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Appointment Confirmed!</h2>
            <p className="text-slate-500 text-sm mb-6">We've received your appointment request. Please arrive 15 minutes early.</p>

            <div className="bg-slate-50 rounded-xl p-5 text-left space-y-3 mb-6">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Patient</span><span className="font-medium">{confirmation.appointment?.patient?.firstName} {confirmation.appointment?.patient?.lastName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">UHID</span><span className="font-mono font-medium">{confirmation.appointment?.patient?.uhid}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Doctor</span><span className="font-medium">Dr. {confirmation.appointment?.doctor?.firstName} {confirmation.appointment?.doctor?.lastName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Date</span><span className="font-medium">{new Date(confirmation.appointment?.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Time</span><span className="font-medium">{confirmation.appointment?.appointmentTime}</span></div>
            </div>

            <p className="text-xs text-slate-400">Please save your UHID <strong>{confirmation.appointment?.patient?.uhid}</strong> for future visits.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto mt-6 text-center text-xs text-slate-400">
        Powered by MediCore HMS · {hospital.name}
      </div>
    </div>
  );
}
