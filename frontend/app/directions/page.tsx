'use client';

import { Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { Direction } from '../../types';

export default function DirectionsPage() {
  const router = useRouter();
  const [directions, setDirections] = useState<Direction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const redirectAccessDenied = (action: string) => {
    router.replace(`/acces-refuse?action=${action}&from=%2Fdirections`);
  };

  const fetchData = async () => {
    try {
      const res = await api.get('/directions');
      setDirections(res.data.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('manage_directions');
        return;
      }
      toast.error('Erreur chargement');
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial volontaire au montage de la page.
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await api.post('/directions', form);
      toast.success('Direction créée');
      setShowForm(false);
      setForm({ name: '', code: '', description: '' });
      fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('create_direction');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Directions" subtitle="Gestion des directions de l'organisation" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          <div className="flex justify-end">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nouvelle direction
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="card space-y-4 border-2 border-primary-100">
              <h2 className="font-semibold text-gray-900">Créer une direction</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">Code</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" placeholder="DRH" />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-none" rows={2} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={isCreating} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {isCreating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isCreating ? 'Création...' : 'Créer'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading
              ? [...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)
              : directions.map((d) => (
                <div key={d.id} className="card flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-primary-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{d.name}</p>
                    {d.code && <p className="text-xs text-primary-600 font-mono mt-0.5">{d.code}</p>}
                    {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{d.nb_utilisateurs} utilisateur(s)</p>
                  </div>
                </div>
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
