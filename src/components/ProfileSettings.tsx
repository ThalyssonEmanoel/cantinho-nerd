import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, User, Trash2, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileSettingsProps {
  onClose: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { player, logout } = useAuth();
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const saveBio = async () => {
    if (!player) return;
    setSaving(true);
    const { error } = await supabase
      .from('players')
      .update({ bio } as any)
      .eq('id', player.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar bio');
    else toast.success('Bio atualizada!');
  };

  const deleteAccount = async () => {
    if (!player || deleteConfirmText !== player.name) return;
    setSaving(true);

    // Delete player (cascades to sessions, participants, tokens, rolls, messages)
    const { error } = await supabase.from('players').delete().eq('id', player.id);

    if (error) {
      toast.error('Erro ao excluir conta: ' + error.message);
      setSaving(false);
      return;
    }

    toast.success('Conta excluída. Até a próxima aventura!');
    logout();
  };

  const deleteSessions = async () => {
    if (!player) return;
    setSaving(true);
    const { error } = await supabase.from('sessions').delete().eq('dm_id', player.id);
    setSaving(false);
    if (error) toast.error('Erro ao excluir sessões');
    else toast.success('Todas as suas sessões foram excluídas!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card-gradient border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {player?.avatar_url ? (
              <img src={player.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gold" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-display text-foreground">{player?.name}</p>
              <p className="text-xs text-muted-foreground">Configurações do Perfil</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Bio */}
          <div>
            <Label className="font-display text-sm">Bio do Aventureiro</Label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Conte um pouco sobre seu personagem ou estilo de jogo..."
              className="mt-1 w-full bg-secondary border border-border rounded-lg p-3 text-sm text-foreground resize-none h-20 focus:outline-none focus:border-gold/50"
              maxLength={280}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{bio.length}/280</span>
              <Button size="sm" className="font-display text-xs h-7" onClick={saveBio} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> Salvar Bio
              </Button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Delete sessions */}
          <div>
            <p className="font-display text-sm text-foreground mb-1">Excluir Minhas Sessões</p>
            <p className="text-xs text-muted-foreground mb-2">
              Exclui todas as sessões que você criou como Mestre, incluindo tokens, mapas e histórico de dados.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="font-display text-xs text-destructive hover:bg-destructive/10"
              onClick={deleteSessions}
              disabled={saving}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Excluir Todas as Sessões
            </Button>
          </div>

          <div className="h-px bg-border" />

          {/* Delete account */}
          <div>
            <p className="font-display text-sm text-destructive mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Excluir Conta
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Exclui permanentemente sua conta e todos os dados vinculados (sessões, personagens, histórico). Esta ação não pode ser desfeita.
            </p>
            {!confirmDelete ? (
              <Button
                variant="secondary"
                size="sm"
                className="font-display text-xs text-destructive hover:bg-destructive/10 border border-destructive/30"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Excluir Minha Conta
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-destructive">
                  Digite <strong>{player?.name}</strong> para confirmar:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={player?.name}
                  className="h-8 bg-secondary text-sm border-destructive/50"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="font-display text-xs flex-1"
                    onClick={deleteAccount}
                    disabled={deleteConfirmText !== player?.name || saving}
                  >
                    Confirmar Exclusão
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-display text-xs"
                    onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
