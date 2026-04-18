import React from 'react';

const LandingPage: React.FC = () => {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="NirogOS website"
                src="/nirog.html"
                className="h-full w-full border-0"
            />
        </div>
    );
};

export default LandingPage;
