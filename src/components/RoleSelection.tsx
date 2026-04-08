import { useAuth } from '@/lib/auth-context';
import { Crown, Sword, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function RoleSelection() {
  const { player, setRole, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-fantasy-gradient">
      <div className="w-full max-w-lg mx-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          {player?.avatar_url && (
            <img src={player.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-gold object-cover" />
          )}
          <h2 className="text-2xl font-display text-foreground">
            Saudações, <span className="text-gold text-glow-gold">{player?.name}</span>
          </h2>
        </div>
        <p className="text-muted-foreground font-body text-lg mb-8">Escolha seu papel nesta aventura</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setRole('dm')}
            className="bg-card-gradient border border-border rounded-xl p-6 sm:p-8 flex flex-col items-center gap-4 hover:border-gold/50 hover:glow-gold transition-all group"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border border-gold/20 flex items-center justify-center group-hover:border-gold/50 transition-all">
              <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
            </div>
            <span className="font-display text-lg sm:text-xl text-foreground">Mestre</span>
            <span className="text-xs sm:text-sm text-muted-foreground">Controle o mundo, mapas e monstros</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setRole('player')}
            className="bg-card-gradient border border-border rounded-xl p-6 sm:p-8 flex flex-col items-center gap-4 hover:border-arcane/50 hover:glow-arcane transition-all group"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border border-arcane/20 flex items-center justify-center group-hover:border-arcane/50 transition-all">
              <Sword className="w-8 h-8 sm:w-10 sm:h-10 text-arcane" />
            </div>
            <span className="font-display text-lg sm:text-xl text-foreground">Jogador</span>
            <span className="text-xs sm:text-sm text-muted-foreground">Entre em uma sessão e aventure-se</span>
          </motion.button>
        </div>

        <Button variant="ghost" className="mt-8 text-muted-foreground" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );
}
