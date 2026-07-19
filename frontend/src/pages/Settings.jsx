import { useState } from 'react';
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthWorkspace } from '../context/AuthWorkspaceContext';

export default function Settings() {
  const { user } = useAuthWorkspace();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault(); setMessage('');
    if (password.length < 6) return setMessage('Use a password with at least 6 characters.');
    if (password !== confirmPassword) return setMessage('Your passwords do not match.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMessage(error.message);
    setPassword(''); setConfirmPassword(''); setMessage('Password updated successfully.');
  };

  const sendReset = async () => {
    setSaving(true); setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setSaving(false); setMessage(error ? error.message : 'A password-reset link was sent to your email.');
  };

  return <div className="mx-auto max-w-3xl space-y-5 pb-4"><section className="panel p-6 sm:p-8"><p className="eyebrow">Account</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em]">Settings</h1><p className="mt-2 text-sm text-zinc-500">Manage how you sign in to LeadPilot.</p><div className="mt-7 flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white/55 p-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Mail size={19}/></span><div><p className="text-sm font-extrabold text-zinc-800">{user?.email}</p><p className="mt-0.5 text-xs text-zinc-500">Your sign-in email address</p></div></div></section><section className="panel p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><ShieldCheck size={20}/></span><div><p className="eyebrow">Security</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">Set or change your password</h2><p className="mt-2 text-sm leading-6 text-zinc-500">If you usually use a magic link or Google, set a password here to enable email-and-password sign-in.</p></div></div><form onSubmit={changePassword} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-zinc-700">New password<input required minLength="6" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control mt-2 w-full"/></label><label className="block text-sm font-bold text-zinc-700">Confirm password<input required minLength="6" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="control mt-2 w-full"/></label><div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={saving} className="button-primary"><KeyRound size={16}/> Save password</button><button type="button" disabled={saving} onClick={sendReset} className="button-secondary">Email a reset link</button></div></form>{message && <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-violet-50 p-3 text-sm text-violet-700"><CheckCircle2 size={16}/>{message}</p>}</section></div>;

}
