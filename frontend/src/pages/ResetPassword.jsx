import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(''); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => { if (active) setReady(Boolean(session)); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { if (active && (event === 'PASSWORD_RECOVERY' || session)) setReady(Boolean(session)); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const submit = async (event) => {
    event.preventDefault(); setMessage('');
    if (password.length < 6) return setMessage('Use a password with at least 6 characters.');
    if (password !== confirmPassword) return setMessage('Your passwords do not match.');
    setSaving(true); const { error } = await supabase.auth.updateUser({ password }); setSaving(false);
    if (error) return setMessage(error.message);
    setMessage('Password updated. Redirecting to your workspace�'); window.setTimeout(() => navigate('/'), 900);
  };
  return <div className="mx-auto max-w-xl py-6"><section className="panel p-7 sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><KeyRound size={20}/></span><p className="eyebrow mt-6">Account recovery</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">Choose a new password</h1>{!ready ? <p className="mt-4 text-sm leading-6 text-zinc-500">Open this page from the latest password-reset email. <Link to="/" className="font-bold text-violet-700">Return to sign in</Link></p> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold text-zinc-700">New password<input required minLength="6" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control mt-2 w-full"/></label><label className="block text-sm font-bold text-zinc-700">Confirm password<input required minLength="6" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="control mt-2 w-full"/></label><button disabled={saving} className="button-primary w-full">Save new password</button></form>}{message && <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-violet-50 p-3 text-sm text-violet-700"><CheckCircle2 size={16}/>{message}</p>}</section></div>;

}
