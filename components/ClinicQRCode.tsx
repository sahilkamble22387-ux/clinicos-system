import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode } from 'lucide-react';

interface ClinicQRCodeProps {
    clinicId: string;
    clinicName: string;
}

const ClinicQRCode: React.FC<ClinicQRCodeProps> = ({ clinicId, clinicName }) => {
    const checkinUrl = `${window.location.origin}/checkin/${clinicId}`;

    return (
        <div className="flex flex-col items-center gap-5 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 mb-3">
                    <QrCode size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Self Check-In</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Patient Self Check-In</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Display this at your reception. Patients scan to join the queue.
                </p>
            </div>

            {/* QR Code */}
            <div className="p-5 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner">
                <QRCodeSVG
                    value={checkinUrl}
                    size={200}
                    fgColor="#4F46E5"
                    level="H"
                    style={{ display: 'block' }}
                />
            </div>

            {/* Clinic name */}
            <p className="text-xs text-slate-400 font-mono tracking-wide">{clinicName}</p>

            {/* Print button */}
            <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
            >
                <Printer size={16} />
                Print QR Code
            </button>
        </div>
    );
};

export default ClinicQRCode;
