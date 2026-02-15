import React, { useState, useEffect } from 'react';
import Loader from './Loader';

const PageLoader = ({ children }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Random delay between 2000ms (2s) and 3000ms (3s)
        const delay = Math.floor(Math.random() * 1000) + 2000;

        const timer = setTimeout(() => {
            setLoading(false);
        }, delay);

        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 9999,
                backgroundColor: '#000000'
            }}>
                <Loader />
            </div>
        );
    }

    return children;
};

export default PageLoader;
