const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    if (err.code === '23505') {
        return res.status(409).json({
            error: 'Duplicate entry. This record already exists.',
            detail: err.detail
        });
    }

    if (err.code === '23503') {
        return res.status(400).json({
            error: 'Referenced record not found. Check component or PCB IDs.',
            detail: err.detail
        });
    }

    if (err.code === '23514') {
        if (err.constraint && err.constraint.includes('current_stock')) {
            return res.status(400).json({
                error: 'Insufficient stock. Cannot reduce inventory below zero.',
                detail: err.detail
            });
        }
        return res.status(400).json({
            error: 'Data constraint violation.',
            detail: err.detail
        });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body.' });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error. Please try again.'
    });
};

module.exports = errorHandler;
