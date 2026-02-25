import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, MessageCircle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

interface QRModalProps {
    isOpen: boolean;
    onClose: () => void;
    clinicId: string;
    clinicName: string;
}

const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, clinicId, clinicName }) => {
    const [copied, setCopied] = useState(false);
    const checkinUrl = `${window.location.origin}/checkin/${clinicId}`;

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(checkinUrl);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsAppShare = () => {
        const text = encodeURIComponent(`Hi! Please use this link to self check-in at ${clinicName}:\n\n${checkinUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const handleEmailShare = () => {
        const subject = encodeURIComponent(`Self Check-in Link for ${clinicName}`);
        const body = encodeURIComponent(`Hi!\n\nPlease use the following link to securely check-in before your appointment at ${clinicName}:\n\n${checkinUrl}\n\nThank you!`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 transition-opacity"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Left Side: QR Code Area */}
                <div className="bg-slate-50 p-8 flex flex-col items-center justify-center md:w-5/12 border-b md:border-b-0 md:border-r border-slate-200 shrink-0 relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-100 rounded-full blur-2xl -ml-10 -mb-10" />

                    <div className="relative z-10 flex flex-col items-center w-full">
                        <div className="p-4 bg-white rounded-3xl border-2 border-indigo-100 shadow-sm mb-6">
                            <QRCodeSVG
                                value={checkinUrl}
                                size={180}
                                fgColor="#4F46E5"
                                level="H"
                                style={{ display: 'block' }}
                            />
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg mb-1 whitespace-nowrap overflow-hidden text-ellipsis px-4 w-full text-center">
                            Mobile Check-In
                        </h3>
                        <p className="text-xs text-slate-500 font-medium tracking-wide">
                            {clinicName}
                        </p>
                    </div>
                </div>

                {/* Right Side: Info & Share Area */}
                <div className="p-8 md:w-7/12 flex flex-col justify-between space-y-6 bg-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-4 whitespace-nowrap overflow-hidden text-ellipsis">{clinicName} Check-in URL</h3>

                        {/* URL Box */}
                        <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl mb-6">
                            <div className="px-3 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600 font-mono w-full">
                                {checkinUrl}
                            </div>
                            <button
                                onClick={handleCopy}
                                className={`shrink-0 flex items-center justify-center p-2 rounded-lg transition-all ${copied ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 shadow-sm'
                                    }`}
                                title="Copy URL"
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>

                        {/* Share Buttons */}
                        <div className="flex gap-3 mb-8">
                            <button
                                onClick={handleWhatsAppShare}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-semibold rounded-xl transition-colors text-sm"
                            >
                                <MessageCircle size={18} />
                                WhatsApp
                            </button>
                            <button
                                onClick={handleEmailShare}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold rounded-xl transition-colors text-sm"
                            >
                                <Mail size={18} />
                                Email
                            </button>
                        </div>
                    </div>

                    {/* How It Works List */}
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-3 uppercase tracking-wider">How it works</h4>
                        <ol className="space-y-3">
                            {[
                                "Patient scans QR or opens the link",
                                "Fills a rapid onboarding form on their phone",
                                "Appears instantly in your Doctor Portal queue",
                            ].map((step, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm text-slate-600 leading-snug">
                                        {step}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default QRModal;
