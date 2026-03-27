import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Swords, Upload, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import heroBg from '@/assets/hero-bg.jpg';

export default function LoginScreen() {
  const { setPlayer } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      toast.error('Preencha nome e senha');
      return;
    }
    setLoading(true);

    try {
      if (mode === 'register') {
        // Upload avatar if provided
        let avatarUrl: string | null = null;
        if (avatarFile) {
          const ext = avatarFile.name.split('.').pop();
          const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('vtt-assets').upload(path, avatarFile);
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from('vtt-assets').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }

        // Simple hash (not cryptographic, just for demo)
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const { data: existing } = await supabase.from('players').select('id').eq('name', name.trim()).maybeSingle();
        if (existing) {
          toast.error('Nome já em uso. Tente fazer login.');
          setLoading(false);
          return;
        }

        const { data: player, error } = await supabase.from('players').insert({
          name: name.trim(),
          password_hash: hashHex,
          avatar_url: avatarUrl,
        }).select().single();

        if (error) throw error;
        setPlayer({ id: player.id, name: player.name, avatar_url: player.avatar_url });
        toast.success('Conta criada!');
      } else {
        // Login
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const { data: player, error } = await supabase
          .from('players')
          .select('*')
          .eq('name', name.trim())
          .eq('password_hash', hashHex)
          .maybeSingle();

        if (error) throw error;
        if (!player) {
          toast.error('Nome ou senha incorretos');
          setLoading(false);
          return;
        }
        setPlayer({ id: player.id, name: player.name, avatar_url: player.avatar_url });
        toast.success(`Bem-vindo, ${player.name}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient relative overflow-hidden">
      <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-gold" />
            <h1 className="text-4xl font-display font-bold text-foreground text-glow-gold tracking-wider">
              REALM VTT
            </h1>
            <Swords className="w-8 h-8 text-gold" />
          </div>
          <p className="text-muted-foreground font-body text-lg">Virtual Tabletop para suas aventuras</p>
        </div>

        <div className="bg-card-gradient border border-border rounded-xl p-8 glow-gold">
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === 'login' ? 'default' : 'secondary'}
              className="flex-1 font-display"
              onClick={() => setMode('login')}
            >
              <LogIn className="w-4 h-4 mr-2" /> Entrar
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'secondary'}
              className="flex-1 font-display"
              onClick={() => setMode('register')}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Registrar
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="font-display text-sm text-foreground">Nome do Aventureiro</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome..."
                className="mt-1 bg-secondary border-border"
              />
            </div>

            <div>
              <Label htmlFor="password" className="font-display text-sm text-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 bg-secondary border-border"
              />
            </div>

            {mode === 'register' && (
              <div>
                <Label className="font-display text-sm text-foreground">Avatar do Personagem</Label>
                <div className="mt-1 flex items-center gap-4">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-gold" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-secondary border-2 border-dashed border-muted-foreground flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    Escolher Imagem
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full font-display text-lg py-5" disabled={loading}>
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar no Reino' : 'Criar Aventureiro'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
