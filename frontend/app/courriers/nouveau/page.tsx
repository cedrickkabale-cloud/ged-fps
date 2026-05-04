'use client';

import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { ROLES_RECEPTION_COURRIERS } from '../../../types';

export default function NouveauCourrierPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    reference: '',
    numero: '',
    nombre_annexes: '0',
    objet: '',
    expediteur: '',
    date_reception: new Date().toISOString().slice(0, 16),
    priorite: 'NORMALE',
    notes: '',
  });

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user?.role || !ROLES_RECEPTION_COURRIERS.includes(user.role)) {
      router.replace('/acces-refuse?action=create_courrier&from=%2Fcourriers%2Fnouveau');
      return;
    }

  }, [isAuthLoading, router, user?.role]);

  const canCreateCourrier = user?.role ? ROLES_RECEPTION_COURRIERS.includes(user.role) : false;

  if (isAuthLoading || !canCreateCourrier) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.objet || !form.expediteur) {
      toast.error('Objet et expéditeur sont requis');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/courriers', form);
      toast.success('Courrier enregistré avec succès');
      router.push(`/courriers/${res.data.courrier.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouveau courrier" subtitle="Enregistrement d'un courrier entrant" />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
          >
            <ArrowLeft size={16} />
            Retour
          </button>

          <div className="max-w-2xl">
            <form onSubmit={handleSubmit} className="card space-y-5">
              <h2 className="font-semibold text-gray-900 text-lg mb-2">Informations du courrier</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="reference">Référence</label>
                  <input
                    id="reference"
                    name="reference"
                    type="text"
                    value={form.reference}
                    onChange={handleChange}
                    className="input"
                    placeholder="REF-2026-001"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="numero">Numéro</label>
                  <input
                    id="numero"
                    name="numero"
                    type="text"
                    value={form.numero}
                    onChange={handleChange}
                    className="input"
                    placeholder="0001/25"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="nombre_annexes">Nombre d&apos;annexes</label>
                  <input
                    id="nombre_annexes"
                    name="nombre_annexes"
                    type="number"
                    min={0}
                    step={1}
                    value={form.nombre_annexes}
                    onChange={handleChange}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="date_reception">Date et heure de réception *</label>
                <input
                  id="date_reception"
                  name="date_reception"
                  type="datetime-local"
                  value={form.date_reception}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="expediteur">Expéditeur *</label>
                <input
                  id="expediteur"
                  name="expediteur"
                  type="text"
                  value={form.expediteur}
                  onChange={handleChange}
                  className="input"
                  placeholder="Ministère de la Santé"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="objet">Objet *</label>
                <input
                  id="objet"
                  name="objet"
                  type="text"
                  value={form.objet}
                  onChange={handleChange}
                  className="input"
                  placeholder="Demande de rapport annuel..."
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="priorite">Priorité</label>
                <select
                  id="priorite"
                  name="priorite"
                  value={form.priorite}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="NORMALE">Normale</option>
                  <option value="URGENTE">🔴 Urgente</option>
                  <option value="CONFIDENTIELLE">🔒 Confidentielle</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="notes">Notes internes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  className="input resize-none"
                  rows={3}
                  placeholder="Observations, remarques..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex items-center justify-center gap-2 sm:w-auto w-full"
                >
                  {isLoading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : <Save size={16} />}
                  {isLoading ? 'Enregistrement...' : 'Enregistrer le courrier'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary sm:w-auto w-full"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
