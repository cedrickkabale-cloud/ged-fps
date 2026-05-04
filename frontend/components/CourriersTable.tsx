'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Courrier, STATUT_COLORS, STATUT_LABELS } from '../types';

interface CourriersTableProps {
  courriers: Courrier[];
  isLoading?: boolean;
}

const PRIORITE_COLORS: Record<string, string> = {
  NORMALE: 'text-gray-500',
  URGENTE: 'text-red-600 font-semibold',
  CONFIDENTIELLE: 'text-orange-600 font-semibold',
};

export default function CourriersTable({ courriers, isLoading }: CourriersTableProps) {
  const router = useRouter();

  const goToCourrier = (id: number) => {
    router.push(`/courriers/${id}`);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (courriers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Aucun courrier trouvé</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
          <tr className="border-b border-slate-200 text-left">
            <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Référence</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase hidden sm:table-cell">N°</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase">Objet</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase hidden sm:table-cell">Expéditeur</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Date réception</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Annexes</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase">Statut</th>
            <th className="py-3 pr-4 text-xs font-semibold text-slate-600 uppercase hidden lg:table-cell">Direction</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {courriers.map((c) => (
            <tr
              key={c.id}
              className="hover:bg-slate-50/70 transition-colors"
              onClick={() => goToCourrier(c.id)}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <span className={clsx('text-xs', PRIORITE_COLORS[c.priorite])}>
                    {c.priorite === 'URGENTE' && '🔴 '}
                    {c.priorite === 'CONFIDENTIELLE' && '🔒 '}
                  </span>
                  <span className="font-mono text-xs font-medium text-slate-700">
                    {c.reference || `#${c.id}`}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-4 text-slate-700 text-xs font-mono hidden sm:table-cell">
                {c.numero || '—'}
              </td>
              <td className="py-3 pr-4">
                <p className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-[220px]">{c.objet}</p>
              </td>
              <td className="py-3 pr-4 text-slate-600 truncate max-w-[140px] hidden sm:table-cell">{c.expediteur}</td>
              <td className="py-3 pr-4 text-slate-500 whitespace-nowrap hidden md:table-cell">
                {format(new Date(c.date_reception), 'dd MMM yyyy', { locale: fr })}
              </td>
              <td className="py-3 pr-4 text-slate-700 text-xs font-medium hidden md:table-cell">
                {typeof c.nombre_annexes === 'number' ? c.nombre_annexes : 0}
              </td>
              <td className="py-3 pr-4">
                <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', STATUT_COLORS[c.statut])}>
                  {STATUT_LABELS[c.statut]}
                </span>
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs hidden lg:table-cell">{c.direction_name || '—'}</td>
              <td className="py-3 px-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToCourrier(c.id);
                  }}
                  className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-semibold text-xs cursor-pointer"
                >
                  <Eye size={14} />
                  Voir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
