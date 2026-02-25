import React from 'react';
import { Pill, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPage = () => {
    const lastUpdated = "February 25, 2026";

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
                    <span className="text-slate-900">Privacy Policy</span>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-12 items-start">

                {/* Table of Contents - Sticky Sidebar */}
                <aside className="w-full md:w-64 shrink-0 hidden md:block sticky top-24">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Table of Contents</h4>
                        <nav className="space-y-3 text-sm font-medium">
                            <a href="#introduction" className="block text-slate-600 hover:text-indigo-600 transition-colors">1. Introduction</a>
                            <a href="#information-collection" className="block text-slate-600 hover:text-indigo-600 transition-colors">2. Information Collection</a>
                            <a href="#how-we-use" className="block text-slate-600 hover:text-indigo-600 transition-colors">3. How We Use Information</a>
                            <a href="#data-security" className="block text-slate-600 hover:text-indigo-600 transition-colors">4. Data Security</a>
                            <a href="#user-rights" className="block text-slate-600 hover:text-indigo-600 transition-colors">5. User Rights</a>
                            <a href="#cookies" className="block text-slate-600 hover:text-indigo-600 transition-colors">6. Cookie Policy</a>
                            <a href="#contact" className="block text-slate-600 hover:text-indigo-600 transition-colors">7. Contact Us</a>
                        </nav>
                    </div>
                </aside>

                {/* Markdown Content Area */}
                <article className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm prose prose-slate max-w-none flex-1">
                    <header className="mb-10 text-center md:text-left border-b border-slate-100 pb-8">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Privacy Policy</h1>
                        <p className="text-slate-500 font-medium tracking-wide">Last Updated: {lastUpdated}</p>
                    </header>

                    <section id="introduction" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            Welcome to ClinicOS ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice or our practices with regard to your personal information, please contact us.
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                            When you visit our website and use our services, you trust us with your personal information. We take your privacy very seriously. In this privacy notice, we seek to explain to you in the clearest way possible what information we collect, how we use it, and what rights you have in relation to it.
                        </p>
                    </section>

                    <section id="information-collection" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Information We Collect</h2>
                        <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed">
                            <li><strong>Personal Information you disclose to us:</strong> We collect names, phone numbers, email addresses, mailing addresses, passwords, and other similar information.</li>
                            <li><strong>Patient Health Data:</strong> As a healthcare platform, we store electronic patient records, medical histories, diagnosis, and treatment plans entered by authorized practitioners. We act as a processor for this data.</li>
                            <li><strong>Information automatically collected:</strong> We automatically collect certain information when you visit, use or navigate the platform. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, and information about how and when you use our services.</li>
                        </ul>
                    </section>

                    <section id="how-we-use" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">3. How We Use Information</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            We use personal information collected via our website for a variety of business purposes described below:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed">
                            <li>To facilitate account creation and logon process.</li>
                            <li>To provide, operate, and maintain our services for clinics.</li>
                            <li>To improve, personalize, and expand our services.</li>
                            <li>To understand and analyze how you use our services.</li>
                            <li>To develop new products, services, features, and functionality.</li>
                            <li>To communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes.</li>
                            <li>To process your transactions and send you related information.</li>
                            <li>To find and prevent fraud.</li>
                        </ul>
                    </section>

                    <section id="data-security" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Data Security</h2>
                        <p className="text-slate-600 leading-relaxed">
                            We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. All medical data is encrypted both in transit and at rest. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security, and improperly collect, access, steal, or modify your information.
                        </p>
                    </section>

                    <section id="user-rights" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Your Privacy Rights</h2>
                        <p className="text-slate-600 leading-relaxed mb-4">
                            Depending on where you are located physically, you may have the right to request access to the personal information we collect from you, change that information, or delete it in some circumstances. To request to review, update, or delete your personal information, please submit a request to our Data Protection Officer.
                        </p>
                    </section>

                    <section id="cookies" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Cookie Policy</h2>
                        <p className="text-slate-600 leading-relaxed">
                            We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Policy. Essential cookies necessary for the secure functioning of the ClinicOS application cannot be disabled.
                        </p>
                    </section>

                    <section id="contact" className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Contact Us</h2>
                        <p className="text-slate-600 leading-relaxed">
                            If you have questions or comments about this notice, you may email us at <a href="mailto:privacy@clinicos.com" className="text-indigo-600 hover:text-indigo-800 font-medium">privacy@clinicos.com</a> or by post to:
                        </p>
                        <address className="mt-4 not-italic text-slate-600 leading-relaxed p-4 bg-slate-50 rounded-xl border border-slate-200">
                            ClinicOS Legal Department<br />
                            123 HealthTech Avenue Suite 400<br />
                            Mumbai, Maharashtra 400001<br />
                            India
                        </address>
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

export default PrivacyPage;
