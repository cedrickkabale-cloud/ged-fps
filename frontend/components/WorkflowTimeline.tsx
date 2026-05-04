'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle, Clock } from 'lucide-react';
import { STATUT_LABELS, Tracking } from '../types';

interface WorkflowTimelineProps {
  tracking: Tracking[];
}

export default function WorkflowTimeline({ tracking }: WorkflowTimelineProps) {
  return (
    <div className="space-y-1">
      {tracking.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          {/* Ligne verticale + icône */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 z-10">
              <CheckCircle size={18} className="text-white" />
            </div>
            {index < tracking.length - 1 && (
              <div className="w-0.5 bg-gray-200 flex-1 my-1" />
            )}
          </div>

          {/* Contenu */}
          <div className={`pb-5 ${index < tracking.length - 1 ? '' : ''}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">
                {STATUT_LABELS[item.statut_apres as keyof typeof STATUT_LABELS] || item.action}
              </span>
              <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                {item.role}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <Clock size={12} />
              <span>
                {format(new Date(item.date_action), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
              {item.acteur_name && (
                <span className="text-gray-400">— par {item.acteur_name}</span>
              )}
            </div>

            {item.commentaire && (
              <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 italic">
                &ldquo;{item.commentaire}&rdquo;
              </p>
            )}
          </div>
        </div>
      ))}

      {tracking.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">Aucun historique disponible</p>
      )}
    </div>
  );
}
