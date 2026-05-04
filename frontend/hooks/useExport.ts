import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Courrier, STATUT_LABELS } from '../types';

// ---------- helpers ----------

function buildFilename(base: string, ext: string, userName: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const safe = userName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `${base}_${safe}_${date}.${ext}`;
}

type ExportColumn = {
  key: string;
  label: string;
  width: number;
};

const GLOBAL_CIRCUIT_ROLES = new Set([
  'ADMIN',
  'DG',
  'DGA',
  'PROTOCOLE',
  'SECRETAIRE_ADMIN',
  'SECRETAIRE_ADMIN_ADJ',
  'SECRETAIRE_DG',
  'SECRETAIRE_DGA',
  'COURRIER_ENTRANT',
  'COURRIER_SORTANT',
]);

function toRole(user: unknown): string {
  const value = (user as { role?: string; role_name?: string } | null)?.role
    ?? (user as { role?: string; role_name?: string } | null)?.role_name
    ?? '';

  return value.toUpperCase().replace(/\s+/g, '_');
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRow(c: Courrier): Record<string, string | number> {
  return {
    id: c.id,
    reference: c.reference ?? `#${c.id}`,
    numero: c.numero ?? '—',
    objet: c.objet,
    expediteur: c.expediteur,
    statut: STATUT_LABELS[c.statut] ?? c.statut,
    priorite: c.priorite,
    type_courrier: c.type_courrier,
    direction: c.direction_name ?? '—',
    nombre_annexes: typeof c.nombre_annexes === 'number' ? c.nombre_annexes : 0,
    date_reception: formatDate(c.date_reception),
    created_by: c.created_by_name ?? '—',
    created_at: formatDateTime(c.created_at),
  };
}

function getExportColumns(role: string): ExportColumn[] {
  const commonColumns: ExportColumn[] = [
    { key: 'reference', label: 'Référence', width: 20 },
    { key: 'numero', label: 'N°', width: 14 },
    { key: 'objet', label: 'Objet', width: 48 },
    { key: 'expediteur', label: 'Expéditeur', width: 28 },
    { key: 'date_reception', label: 'Date réception', width: 18 },
    { key: 'nombre_annexes', label: 'Annexes', width: 10 },
    { key: 'statut', label: 'Statut', width: 22 },
    { key: 'direction', label: 'Direction', width: 24 },
  ];

  // Les profils du circuit global exportent toutes les colonnes de pilotage.
  if (GLOBAL_CIRCUIT_ROLES.has(role)) {
    return [
      { key: 'id', label: 'ID', width: 8 },
      ...commonColumns,
      { key: 'priorite', label: 'Priorité', width: 14 },
      { key: 'type_courrier', label: 'Type', width: 12 },
      { key: 'created_by', label: 'Créé par', width: 22 },
      { key: 'created_at', label: 'Date création', width: 20 },
    ];
  }

  // Profils directionnels/assistants: uniquement les colonnes visibles au quotidien.
  return commonColumns;
}

// ---------- hook ----------

export function useExport() {
  const { user } = useAuth();
  const role = toRole(user);
  const columns = getExportColumns(role);
  const userName: string =
    (user as { name?: string; full_name?: string; email?: string } | null)?.name ??
    (user as { name?: string; full_name?: string; email?: string } | null)?.full_name ??
    (user as { name?: string; full_name?: string; email?: string } | null)?.email ??
    'inconnu';

  // ---- Excel ----
  const exportExcel = useCallback(
    async (courriers: Courrier[], fileBase = 'courriers') => {
      const { utils, writeFile } = await import('xlsx');

      const rows = courriers.map((c) => {
        const mapped = formatRow(c);
        const row: Record<string, string | number> = {};
        columns.forEach((col) => {
          row[col.label] = mapped[col.key];
        });
        return row;
      });
      const ws = utils.json_to_sheet(rows);

      // Largeurs colonnes
      ws['!cols'] = columns.map((col) => ({ wch: col.width }));

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Courriers');
      writeFile(wb, buildFilename(fileBase, 'xlsx', userName));
    },
    [columns, userName]
  );

  // ---- PDF ----
  const exportPdf = useCallback(
    async (courriers: Courrier[], fileBase = 'courriers', title = 'Liste des courriers') => {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');

      // jsPDF peut être default ou { jsPDF }
      const JsPDF =
        (jsPDFModule as { default?: { new (...a: unknown[]): unknown }; jsPDF?: { new (...a: unknown[]): unknown } })
          .default ??
        (jsPDFModule as { jsPDF: { new (...a: unknown[]): unknown } }).jsPDF;

      const autoTable =
        (autoTableModule as { default?: (...a: unknown[]) => void }).default ??
        (autoTableModule as { autoTable?: (...a: unknown[]) => void }).autoTable;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = new (JsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // En-tête
      doc.setFontSize(14);
      doc.setTextColor(15, 63, 138);
      doc.text('GED FPS — ' + title, 14, 16);

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Exporté par : ${userName}`, 14, 22);
      doc.text(`Date : ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 27);

      const head = [columns.map((col) => col.label)];
      const body = courriers.map((c) => {
        const mapped = formatRow(c);
        return columns.map((col) => String(mapped[col.key] ?? '—'));
      });

      const columnStyles = columns.reduce<Record<number, { cellWidth: number }>>((acc, col, index) => {
        acc[index] = { cellWidth: col.width };
        return acc;
      }, {});

      (autoTable as (...a: unknown[]) => void)(doc, {
        startY: 32,
        head,
        body,
        styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [15, 63, 138], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles,
        tableWidth: 'auto',
      });

      // Numéros de page
      const pageCount: number = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 8);
      }

      doc.save(buildFilename(fileBase, 'pdf', userName));
    },
    [columns, userName]
  );

  return { exportExcel, exportPdf };
}
