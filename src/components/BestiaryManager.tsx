import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Save, Trash2, Search, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Creature {
  id: string;
  name: string;
  system: string;
  creature_type: string;
  size: string;
  hp_max: number;
  ac: number;
  speed: number;
  description: string;
  image_url: string;
  challenge_rating: string;
  nex?: number;
  attacks: any[];
  abilities: any[];
}

interface BestiaryManagerProps {
  dmId: string;
  system: string;
  onClose: () => void;
  onSelectCreature?: (creature: Creature) => void;
}

export default function BestiaryManager({ dmId, system, onClose, onSelectCreature }: BestiaryManagerProps) {
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCreature, setEditingCreature] = useState<Creature | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [creatureType, setCreatureType] = useState('');
  const [size, setSize] = useState('médio');
  const [hpMax, setHpMax] = useState('');
  const [ac, setAc] = useState('');
  const [speed, setSpeed] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [challengeRating, setChallengeRating] = useState('');
  const [nex, setNex] = useState('');

  useEffect(() => {
    loadCreatures();
  }, [dmId, system]);

  const loadCreatures = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bestiary_creatures')
      .select('*')
      .eq('dm_id', dmId)
      .eq('system', system)
      .order('name');
    
    if (data) setCreatures(data as Creature[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setCreatureType('');
    setSize('médio');
    setHpMax('');
    setAc('');
    setSpeed('');
    setDescription('');
    setImageUrl('');
    setChallengeRating('');
    setNex('');
    setEditingCreature(null);
  };

  const saveCreature = async () => {
    if (!name.trim() || !hpMax) {
      toast.error('Preencha nome e HP');
      return;
    }

    const creatureData = {
      dm_id: dmId,
      name: name.trim(),
      system,
      creature_type: creatureType,
      size,
      hp_max: parseInt(hpMax),
      ac: ac ? parseInt(ac) : null,
      speed: speed ? parseInt(speed) : null,
      description,
      image_url: imageUrl,
      challenge_rating: challengeRating,
      nex: system === 'ordem_paranormal' && nex ? parseInt(nex) : null,
      attacks: [],
      abilities: [],
    };

    if (editingCreature) {
      const { error } = await supabase
        .from('bestiary_creatures')
        .update(creatureData)
        .eq('id', editingCreature.id);
      
      if (error) {
        toast.error('Erro ao atualizar criatura');
      } else {
        toast.success('Criatura atualizada');
        loadCreatures();
        setShowForm(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('bestiary_creatures')
        .insert(creatureData);
      
      if (error) {
        toast.error('Erro ao criar criatura');
      } else {
        toast.success('Criatura criada');
        loadCreatures();
        setShowForm(false);
        resetForm();
      }
    }
  };

  const deleteCreature = async (id: string) => {
    if (!confirm('Excluir esta criatura?')) return;
    
    const { error } = await supabase
      .from('bestiary_creatures')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Criatura excluída');
      loadCreatures();
    }
  };

  const editCreature = (creature: Creature) => {
    setEditingCreature(creature);
    setName(creature.name);
    setCreatureType(creature.creature_type || '');
    setSize(creature.size || 'médio');
    setHpMax(creature.hp_max.toString());
    setAc(creature.ac?.toString() || '');
    setSpeed(creature.speed?.toString() || '');
    setDescription(creature.description || '');
    setImageUrl(creature.image_url || '');
    setChallengeRating(creature.challenge_rating || '');
    setNex(creature.nex?.toString() || '');
    setShowForm(true);
  };

  const filteredCreatures = creatures.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.creature_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            <h2 className="font-display text-lg text-foreground">Bestiário</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Lista de criaturas */}
          {!showForm && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar criaturas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Criatura
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
                  </div>
                ) : filteredCreatures.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-display">
                      {searchTerm ? 'Nenhuma criatura encontrada' : 'Nenhuma criatura no bestiário'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredCreatures.map(creature => (
                      <div
                        key={creature.id}
                        className="bg-secondary/30 border border-border rounded-lg p-3 hover:border-gold/40 transition-all group"
                      >
                        <div className="flex gap-3">
                          {creature.image_url ? (
                            <img
                              src={creature.image_url}
                              alt={creature.name}
                              className="w-16 h-16 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display text-sm font-bold truncate">{creature.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {creature.creature_type} • {creature.size}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-red-500">❤️ {creature.hp_max}</span>
                              <span className="text-blue-500">🛡️ {creature.ac || '—'}</span>
                              {system === 'ordem_paranormal' && creature.nex && (
                                <span className="text-purple-500">NEX {creature.nex}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => editCreature(creature)}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {onSelectCreature && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onSelectCreature(creature)}
                                className="h-7 w-7 p-0 text-gold"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCreature(creature.id)}
                              className="h-7 w-7 p-0 text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulário */}
          {showForm && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg">
                    {editingCreature ? 'Editar Criatura' : 'Nova Criatura'}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goblin" />
                  </div>

                  <div>
                    <Label>Tipo</Label>
                    <Input value={creatureType} onChange={(e) => setCreatureType(e.target.value)} placeholder="Humanoide" />
                  </div>

                  <div>
                    <Label>Tamanho</Label>
                    <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full h-10 px-3 rounded-md border border-border bg-background">
                      <option value="minúsculo">Minúsculo</option>
                      <option value="pequeno">Pequeno</option>
                      <option value="médio">Médio</option>
                      <option value="grande">Grande</option>
                      <option value="enorme">Enorme</option>
                      <option value="colossal">Colossal</option>
                    </select>
                  </div>

                  <div>
                    <Label>HP Máximo</Label>
                    <Input type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} placeholder="30" />
                  </div>

                  <div>
                    <Label>{system === 'ordem_paranormal' ? 'Defesa' : 'CA'}</Label>
                    <Input type="number" value={ac} onChange={(e) => setAc(e.target.value)} placeholder="15" />
                  </div>

                  <div>
                    <Label>Velocidade</Label>
                    <Input type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="30" />
                  </div>

                  <div>
                    <Label>{system === 'ordem_paranormal' ? 'NEX' : 'CR'}</Label>
                    <Input
                      value={system === 'ordem_paranormal' ? nex : challengeRating}
                      onChange={(e) => system === 'ordem_paranormal' ? setNex(e.target.value) : setChallengeRating(e.target.value)}
                      placeholder={system === 'ordem_paranormal' ? '50' : '1/2'}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>URL da Imagem</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                  </div>

                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descrição da criatura..."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveCreature} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {editingCreature ? 'Atualizar' : 'Salvar'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
