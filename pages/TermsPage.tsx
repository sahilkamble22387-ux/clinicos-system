import React from 'react';
import { Pill, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsPage = () => {
    const lastUpdated = "February 25, 2026";
    const version = "1.0.4";

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Navigation Bar Minimal */}
            <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
                        <Pill className="text-white w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg text-slate-900 tracking-tight">ClinicOS</span>
                </Link>
                <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-2 px-4">
                    Back to Home
                </Link>
            </nav>

            {/* Breadcrumbs */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-8">
                    <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
                    <ChevronRight size={14} />
                    <span className="text-slate-900">Terms of Service</span>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-12 items-start">

                {/* Table of Contents - Sticky Sidebar */}
                <aside className="w-full md:w-64 shrink-0 hidden md:block sticky top-24">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Table of Contents</h4>
                        <nav className="space-y-3 text-sm font-medium">
                            <a href="#acceptance" className="block text-slate-600 hover:text-indigo-600 transition-colors">1. Acceptance of Terms</a>
                            <a href="#license" className="block text-slate-600 hover:text-indigo-600 transition-colors">2. Use License</a>
                            <a href="#disclaimer" className="block text-slate-600 hover:text-indigo-600 transition-colors">3. Disclaimer</a>
                            <a href="#limitations" className="block text-slate-600 hover:text-indigo-600 transition-colors">4. Limitations of Liability</a>
                            <a href="#accuracy" className="block text-slate-600 hover:text-indigo-600 transition-colors">5. Accuracy of Materials</a>
                            <a href="#links" className="block text-slate-600 hover:text-indigo-600 transition-colors">6. Links</a>
                            <a href="#modifications" className="block text-slate-600 hover:text-indigo-600 transition-colors">7. Modifications to Terms</a>
                            <a href="#governing" className="block text-slate-600 hover:text-indigo-600 transition-colors">8. Governing Law</a>
                        </nav>
                    </div>
                </aside>

                {/* Markdown Content Area */}
                <article className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm prose prose-slate max-w-none flex-1">
                    <header className="mb-10 text-center md:text-left border-b border-slate-100 pb-8">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Terms of Service</h1>
                        <div className="flex flex-col md:flex-row gap-2 mt-2 text-slate-500 font-medium tracking-wide">
                            <span>Last Updated: {lastUpdated}</span>
                            <span className="hidden md:inline">•</span>
                            <span>Version: {version}</span>
                        </div>
                    </header>

                    <section id="acceptance" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            By accessing the website at ClinicOS.com, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site. The materials contained in this website are protected by applicable copyright and trademark law.
                        </p>
                    </section>

                    <section id="license" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Use License</h2>
                        <ol className="list-[lower-alpha] pl-5 space-y-3 text-slate-600 leading-relaxed">
                            <li>Permission is granted to temporarily download one copy of the materials (information or software) on ClinicOS's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>modify or copy the materials;</li>
                                    <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
                                    <li>attempt to decompile or reverse engineer any software contained on ClinicOS's website;</li>
                                    <li>remove any copyright or other proprietary notations from the materials; or</li>
                                    <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
                                </ul>
                            </li>
                            <li>This license shall automatically terminate if you violate any of these restrictions and may be terminated by ClinicOS at any time. Upon terminating your viewing of these materials or upon the termination of this license, you must destroy any downloaded materials in your possession whether in electronic or printed format.</li>
                        </ol>
                    </section>

                    <section id="disclaimer" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Disclaimer</h2>
                        <p className="text-slate-600 leading-relaxed">
                            The materials on ClinicOS's website are provided on an 'as is' basis. ClinicOS makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights. Furthermore, ClinicOS does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
                        </p>
                        <p className="text-slate-600 leading-relaxed mt-4 font-semibold p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                            Medical Disclaimer: ClinicOS is a software tool designed to assist healthcare professionals. It does not provide medical advice. Healthcare providers using the software are solely responsible for the medical care and advice they provide to their patients.
                        </p>
                    </section>

                    <section id="limitations" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Limitations of Liability</h2>
                        <p className="text-slate-600 leading-relaxed">
                            In no event shall ClinicOS or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on ClinicOS's website, even if ClinicOS or a ClinicOS authorized representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.
                        </p>
                    </section>

                    <section id="accuracy" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Accuracy of Materials</h2>
                        <p className="text-slate-600 leading-relaxed">
                            The materials appearing on ClinicOS's website could include technical, typographical, or photographic errors. ClinicOS does not warrant that any of the materials on its website are accurate, complete or current. ClinicOS may make changes to the materials contained on its website at any time without notice. However ClinicOS does not make any commitment to update the materials.
                        </p>
                    </section>

                    <section id="links" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Links</h2>
                        <p className="text-slate-600 leading-relaxed">
                            ClinicOS has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by ClinicOS of the site. Use of any such linked website is at the user's own risk.
                        </p>
                    </section>

                    <section id="modifications" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Modifications to Terms</h2>
                        <p className="text-slate-600 leading-relaxed">
                            ClinicOS may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
                        </p>
                    </section>

                    <section id="governing" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Governing Law</h2>
                        <p className="text-slate-600 leading-relaxed">
                            These terms and conditions are governed by and construed in accordance with the laws of India and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
                        </p>
                    </section>

                    <section id="contact" className="mb-8 pt-8 border-t border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Information</h2>
                        <p className="text-slate-600 leading-relaxed">
                            If you have any questions about these Terms, please contact us at <a href="mailto:legal@clinicos.com" className="text-indigo-600 hover:text-indigo-800 font-medium">legal@clinicos.com</a>.
                        </p>
                    </section>

                </article>
            </main>

            {/* Footer minimal */}
            <footer className="mt-24 border-t border-slate-200 py-8 text-center text-slate-500">
                <p>© 2026 ClinicOS. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default TermsPage;
