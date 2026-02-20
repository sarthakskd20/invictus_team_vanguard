import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { DottedSurface } from '../components/ui/dotted-surface';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isRegister) {
                await register(username, email, password);
            } else {
                await login(username, password);
            }
            navigate('/select');
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* ── Full-viewport fixed shell ──────────────────────────────── */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100%',
                background: '#0a0a0a',
                overflow: 'hidden',
                zIndex: 0,
            }}>
                {/* Three.js dotted wave — fills entire shell */}
                <DottedSurface />

                {/* Subtle blue radial glow */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.07) 0%, transparent 60%)',
                    pointerEvents: 'none',
                }} />
            </div>

            {/* ── Sign-in card — absolutely centred over the shell ──────── */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                width: '100%',
                maxWidth: '380px',
                padding: '0 1rem',
                boxSizing: 'border-box',
            }}>
                <div style={{
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(18,18,18,0.9) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
                    padding: '2.25rem 2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    {/* Logo */}
                    <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '1.25rem',
                        boxShadow: '0 0 20px rgba(59,130,246,0.35)',
                        fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '1px',
                        flexShrink: 0,
                    }}>IV</div>

                    {/* Title */}
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff', marginBottom: '0.25rem', textAlign: 'center' }}>
                        Invictus Inventory
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: '1.75rem', textAlign: 'center' }}>
                        {isRegister ? 'Create your account' : 'Sign in to continue'}
                    </p>

                    {/* Error */}
                    {error && (
                        <div style={{
                            width: '100%', marginBottom: '1rem',
                            padding: '10px 14px', borderRadius: '12px',
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                            color: '#fca5a5', fontSize: '0.78rem', boxSizing: 'border-box',
                        }}>{error}</div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input
                            id="username" type="text" value={username} required autoComplete="username"
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            style={inputStyle}
                            onFocus={(e) => Object.assign(e.target.style, { ...inputStyle, ...focusStyle })}
                            onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                        />

                        {isRegister && (
                            <input
                                id="email" type="email" value={email} required autoComplete="email"
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                style={inputStyle}
                                onFocus={(e) => Object.assign(e.target.style, { ...inputStyle, ...focusStyle })}
                                onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                            />
                        )}

                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                id="password" type={showPassword ? 'text' : 'password'}
                                value={password} required
                                autoComplete={isRegister ? 'new-password' : 'current-password'}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                style={{ ...inputStyle, paddingRight: '42px' }}
                                onFocus={(e) => Object.assign(e.target.style, { ...inputStyle, ...focusStyle, paddingRight: '42px' })}
                                onBlur={(e) => Object.assign(e.target.style, { ...inputStyle, paddingRight: '42px' })}
                            />
                            <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
                                }}>
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />

                        <button type="submit" disabled={loading}
                            style={{
                                width: '100%', padding: '11px 20px', borderRadius: '50px', border: 'none',
                                background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem',
                                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'background 0.15s', opacity: loading ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
                            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        >
                            {loading ? <span style={spinnerStyle} /> : isRegister ? 'Create Account' : 'Sign In'}
                        </button>

                        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}
                                style={{
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)',
                                    fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
                                    textDecoration: 'underline', padding: 0
                                }}>
                                {isRegister ? 'Sign In' : "Sign up, it's free!"}
                            </button>
                        </p>
                    </form>
                </div>
            </div>

            {/* ── Social proof — pinned near bottom ─────────────────────── */}
            <div style={{
                position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    Trusted by the <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Invictus team</span>
                </p>
                <div style={{ display: 'flex' }}>
                    {[
                        'https://randomuser.me/api/portraits/men/32.jpg',
                        'https://randomuser.me/api/portraits/women/44.jpg',
                        'https://randomuser.me/api/portraits/men/54.jpg',
                        'https://randomuser.me/api/portraits/women/68.jpg',
                    ].map((src, i) => (
                        <img key={i} src={src} alt="team member"
                            style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                border: '2px solid #0a0a0a', objectFit: 'cover',
                                marginLeft: i === 0 ? 0 : '-7px'
                            }} />
                    ))}
                </div>
            </div>

            {/* Spinner keyframe */}
            <style>{`@keyframes _iv_spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}

const inputStyle = {
    width: '100%', padding: '11px 16px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, background 0.15s', fontFamily: 'inherit',
};

const focusStyle = {
    borderColor: 'rgba(59,130,246,0.6)',
    background: 'rgba(255,255,255,0.09)',
};

const spinnerStyle = {
    display: 'inline-block', width: '15px', height: '15px',
    border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff',
    borderRadius: '50%', animation: '_iv_spin 0.6s linear infinite',
};
