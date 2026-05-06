'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Printer } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../lib/api';
import { Courrier, ROLES_RECEPTION_COURRIERS } from '../../../../types';

const SLOGAN = "Pour l\u2019am\u00e9lioration de la qualit\u00e9 de l\u2019offre des soins et des services de sant\u00e9 en RDC";

export default function EtiquetteCourrierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [courrier, setCourrier] = useState<Courrier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [printProfile, setPrintProfile] = useState<'standard' | 'thermal' | 'extreme'>('thermal');

  const normalizedRole = (user?.role || user?.role_name || '').toUpperCase().replace(/\s+/g, '_');
  const canPrintLabel = ROLES_RECEPTION_COURRIERS.includes(normalizedRole);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace(`/login?from=%2Fcourriers%2F${id}%2Fetiquette`);
      return;
    }
    if (!canPrintLabel) {
      router.replace(`/acces-refuse?action=print_label&from=%2Fcourriers%2F${id}%2Fetiquette`);
    }
  }, [canPrintLabel, id, isAuthLoading, router, user]);

  useEffect(() => {
    if (!canPrintLabel) return;
    const fetchCourrier = async () => {
      try {
        const response = await api.get(`/courriers/${id}`);
        setCourrier(response.data.courrier);
      } catch {
        toast.error('Impossible de charger le courrier');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourrier();
  }, [canPrintLabel, id]);

  useEffect(() => {
    if (!courrier) return;

    const payload = JSON.stringify({
      id: courrier.id,
      ref: courrier.reference || `#${courrier.id}`,
      exp: courrier.expediteur,
      date: courrier.date_reception,
      objet: courrier.objet,
    });

    // errorCorrectionLevel L = QR plus simple → lisible même en très petite taille
    QRCode.toDataURL(payload, { width: 256, margin: 1, errorCorrectionLevel: 'L' })
      .then(setQrDataUrl)
      .catch(() => toast.error('Impossible de générer le QR code'));
  }, [courrier]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canPrintLabel) return null;

  if (!courrier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center space-y-3">
          <p className="text-slate-700">Courrier introuvable</p>
          <button onClick={() => router.push('/courriers')} className="btn-primary">
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  // ── Valeurs formatées ─────────────────────────────────────────
  // Le format physique attendu est toujours FPS/AR
  const typeLabel = 'AR';
  const rawNumero = courrier.numero || courrier.reference || `#${courrier.id}`;
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const numeroLabel = rawNumero.replace(/^NO-/i, '') + `/${yearSuffix}`;
  const dateReceptionLabel = courrier.date_reception
    ? `Date : ${format(new Date(courrier.date_reception), 'dd/MM/yyyy', { locale: fr })}`
    : 'Date : —';
  const heureLabel = courrier.created_at
    ? format(new Date(courrier.created_at), 'HH:mm', { locale: fr })
    : '—';
  const annexesLabel = typeof courrier.nombre_annexes === 'number' ? courrier.nombre_annexes : 0;
  const isThermal = printProfile === 'thermal';
  const isExtreme = printProfile === 'extreme';
  const borderMain = '0.4mm solid #000';
  const dividerBorder = '0.3mm solid #000';
  const rightColW = '18mm';
  const qrSize = '17.2mm';

  // ── Étiquette partagée écran/impression ──────────────────────
  const LabelContent = () => (
    <div
      className={`label-print ${isThermal ? 'label-print-thermal' : ''} ${isExtreme ? 'label-print-extreme' : ''}`}
      style={{
        width: '40mm',
        height: '25mm',
        display: 'flex',
        flexDirection: 'row',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: borderMain,
        padding: 0,
        gap: 0,
      }}
    >
      {/* ── Colonne gauche ───────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto auto auto auto auto 0.2mm 1fr',
          alignItems: 'stretch',
          padding: '1.5mm 1.5mm 0.1mm 0.78mm',
          boxSizing: 'border-box',
          rowGap: '0',
        }}
      >
        {/* FPS / AR — mis en valeur */}
        <p style={{
          margin: 0,
          fontSize: '11.5pt',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}>
          FPS&nbsp;/&nbsp;{typeLabel}
        </p>

        {/* Numéro */}
        <p style={{
          margin: '0.12mm 0 0 0',
          fontSize: '9.2pt',
          fontWeight: 800,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}>
          N°{numeroLabel}
        </p>

        {/* Ligne 3 : Réception (jour + date) */}
        <p style={{
          margin: '0.1mm 0 0 0',
          fontSize: '7pt',
          fontWeight: 700,
          lineHeight: 1,
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          {dateReceptionLabel}
        </p>

        {/* Ligne 4 : Heure */}
        <p style={{
          margin: '0.04mm 0 0 0',
          fontSize: '7pt',
          fontWeight: 700,
          lineHeight: 1,
          textAlign: 'left',
          whiteSpace: 'nowrap',
        }}>
          Heure&nbsp;: {heureLabel}
        </p>

        {/* Annexes */}
        <p style={{
          margin: '0.08mm 0 0 0',
          fontSize: '7.4pt',
          fontWeight: 800,
          lineHeight: 1,
          textAlign: 'left',
          whiteSpace: 'nowrap',
        }}>
          Annexes&nbsp;: {annexesLabel}
        </p>

        {/* Séparateur fin */}
        <div style={{ height: '0.2mm', background: '#b8b8b8', width: '100%' }} />

        {/* Slogan — justifié */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', overflow: 'hidden' }}>
          <p style={{
            margin: '0.2mm 0 0 0',
            fontSize: '3.7pt',
            fontWeight: 800,
            lineHeight: 1.15,
            textAlign: 'justify',
            textAlignLast: 'justify',
            wordBreak: 'normal',
            overflowWrap: 'anywhere',
            hyphens: 'none',
            color: '#222',
            width: '100%',
          }}>
            {SLOGAN}
          </p>
        </div>
      </div>

      {/* ── Séparateur vertical ──────────────────────────── */}
      <div style={{ width: dividerBorder, background: '#000', alignSelf: 'stretch', flexShrink: 0 }} />

      {/* ── Colonne droite : QR Code plein format ─────────── */}
      <div
        style={{
          width: rightColW,
          flexShrink: 0,
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.3mm 0.3mm 0.3mm 0.95mm',
        }}
      >
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            className="label-qr-img"
            style={{ width: qrSize, height: qrSize, display: 'block', imageRendering: 'pixelated' }}
          />
        ) : (
          <div style={{ width: qrSize, height: qrSize, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.3mm solid #ccc' }}>
            <span style={{ fontSize: '3pt', color: '#999' }}>QR…</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        /* ── Format thermique Barcode 4B 2074G : 40 × 25 mm ── */
        @page {
          size: 40mm 25mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 40mm;
            height: 25mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            position: relative;
          }

          footer,
          [data-nextjs-toast],
          [data-react-hot-toast],
          [role="status"],
          [role="alert"] {
            display: none !important;
          }

          /* Cacher tout sauf l'étiquette à imprimer */
          .print-controls,
          .label-preview-shell {
            display: none !important;
          }

          /* L'étiquette d'impression occupe toute la page */
          .label-print-wrapper {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 40mm !important;
            height: 25mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .label-print {
            width: 40mm !important;
            height: 25mm !important;
            border: none !important;
            padding: 0.25mm !important;
            margin: 0 !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .label-print .label-qr-img {
            width: ${qrSize} !important;
            height: ${qrSize} !important;
          }

          .label-print.label-print-thermal {
            filter: contrast(1.38) brightness(0.78) saturate(0);
          }

          .label-print.label-print-extreme {
            filter: contrast(1.45) brightness(0.72) saturate(0);
          }
        }
      `}</style>

      {/* ── Barre de contrôle (écran seulement) ── */}
      <div className="print-controls min-h-screen bg-neutral-200 flex flex-col items-center justify-center px-4 py-10 gap-8">

        {/* Titre */}
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-800">Aperçu de l&apos;étiquette</h1>
          <p className="text-xs text-slate-500 mt-0.5">Format thermique · Barcode 4B 2074G · 40 mm × 25 mm</p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 shadow-sm">
          <button
            onClick={() => setPrintProfile('standard')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              printProfile === 'standard' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setPrintProfile('thermal')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              printProfile === 'thermal' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Thermique renforcé
          </button>
          <button
            onClick={() => setPrintProfile('extreme')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              printProfile === 'extreme' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Thermique extrême
          </button>
        </div>

        {/* ── Aperçu zoomé 4× ── */}
        <div className="label-preview-shell flex flex-col items-center gap-3">
          {/* Conteneur qui annonce la taille réelle puis zoom CSS */}
          <div
            style={{
              width: `calc(40mm * 4)`,
              height: `calc(25mm * 4)`,
              transform: 'scale(1)',
              transformOrigin: 'top left',
              position: 'relative',
            }}
          >
            {/* Zone de prévisualisation papier thermique */}
            <div
              style={{
                width: '40mm',
                height: '25mm',
                transform: 'scale(4)',
                transformOrigin: 'top left',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                borderRadius: '1px',
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.008) 0px, rgba(0,0,0,0.008) 1px, transparent 1px, transparent 4px)',
              }}
            >
              <LabelContent />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">Aperçu agrandi 4× — taille réelle : 40 mm × 25 mm</p>
        </div>

        {/* Boutons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/courriers/${courrier.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={15} />
            Retour
          </button>

          <button
            onClick={() => window.print()}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={15} />
            Imprimer l&apos;étiquette
          </button>
        </div>
      </div>

      {/* ── Zone réservée à l'impression (invisible à l'écran) ── */}
      <div className="label-print-wrapper" style={{ display: 'none' }}>
        <LabelContent />
      </div>
    </>
  );
}
