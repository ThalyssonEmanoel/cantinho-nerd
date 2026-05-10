import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Save, Trash2, Play, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Creature {
  id: string;
  name: string;
  hp_max: number;
  ac: number;
  image_url: string;
}

interface EncounterCreature {
  creature_id: string;
  count: number;
  hidden: boolean;
  creature?: Creature;
}

interface SavedEncounter {
  id: string;
  name: string;
  description: string;
  creatures: EncounterCreature[];
  difficulty: string;
}

interface EncounterBuilderProps {
  dmId: string;
  sessionId: string;
  system: string;
  onClose: () => void;
  onSpawn?: (encounterId: string) => void;
}

export default function EncounterBuilder({ dmId, sessionId, system, onClose, onSpawn }: EncounterBuilderProps) {
  const [encounters, setEncounters] = useState<SavedEncounter[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEncounter, setEditingEncounter] = useState<SavedEncounter | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('médio');
  const [encounterCreatures, setEncounterCreatures] = useState<EncounterCreature[]>([]);

  useEffect(() => {
    loadEncounters();
    loadCreatures();
  }, [dmId, system]);

  const loadEncounters = async () => {
    const { data } = await supabase
      .from('saved_encounters')
      .select('*')
      .eq('dm_id', dmId)
      .eq('system', system)
      .order('created_at', { ascending: false });
    
    if (data) {
      // Carregar dados das criaturas
      const encountersWithCreatures = await Promise.all(
        data.map(async (enc: any) => {
          const creatureIds = enc.creatures.map((c: any) => c.creature_id);
          const { data: creaturesData } = await supabase
            .from('bestiary_creatures')
            .select('id, name, hp_max, ac, image_url')
            .in('id', creatureIds);
          
          const creaturesMap = new Map(creaturesData?.map(c => [c.id, c]) || []);
          
          return {
            ...enc,
            creatures: enc.creatures.map((c: any) => ({
              ...c,
              creature: creaturesMap.get(c.creature_id)
            }))
          };
        })
      );
      
      setEncounters(encountersWithCreatures);
    }
  };

  const loadCreatures = async () => {
    const { data } = await supabase
      .from('bestiary_creatures')
      .select('id, name, hp_max, ac, image_url')
      .eq('dm_id', dmId)
      .eq('system', system)
      .order('name');
    
    if (data) setCreatures(data as Creature[]);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setDifficulty('médio');
    setEncounterCreatures([]);
    setEditingEncounter(null);
  };

  const addCreatureToEncounter = (creatureId: string) => {
    const existing = encounterCreatures.find(c => c.creature_id === creatureId);
    if (existing) {
      setEncounterCreatures(prev =>
        prev.map(c => c.creature_id === creatureId ? { ...c, count: c.count + 1 } : c)
      );
    } else {
      setEncounterCreatures(prev => [
        ...prev,
        { creature_id: creatureId, count: 1, hidden: false }
      ]);
    }
  };

  const removeCreatureFromEncounter = (creatureId: string) => {
    setEncounterCreatures(prev => prev.filter(c => c.creature_id !== creatureId));
  };

  const updateCreatureCount = (creatureId: string, count: number) => {
    if (count <= 0) {
      removeCreatureFromEncounter(creatureId);
    } else {
      setEncounterCreatures(prev =>
        prev.map(c => c.creature_id === creatureId ? { ...c, count } : c)
      );
    }
  };

  const toggleCreatureHidden = (creatureId: string) => {
    setEncounterCreatures(prev =>
      prev.map(c => c.creature_id === creatureId ? { ...c, hidden: !c.hidden } : c)
    );
  };

  const saveEncounter = async () => {
    if (!name.trim() || encounterCreatures.length === 0) {
      toast.error('Preencha nome e adicione criaturas');
      return;
    }

    const encounterData = {
      dm_id: dmId,
      session_id: sessionId,
      name: name.trim(),
      description,
      system,
      difficulty,
      creatures: encounterCreatures,
    };

    if (editingEncounter) {
      const { error } = await supabase
        .from('saved_encounters')
        .update(encounterData)
        .eq('id', editingEncounter.id);
      
      if (error) {
        toast.error('Erro ao atualizar encontro');
      } else {
        toast.success('Encontro atualizado');
        loadEncounters();
        setShowForm(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('saved_encounters')
        .insert(encounterData);
      
      if (error) {
        toast.error('Erro ao criar encontro');
      } else {
        toast.success('Encontro salvo');
        loadEncounters();
        setShowForm(false);
        resetForm();
      }
    }
  };

  const deleteEncounter = async (id: string) => {
    if (!confirm('Excluir este encontro?')) return;
    
    const { error } = await supabase
      .from('saved_encounters')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Encontro excluído');
      loadEncounters();
    }
  };

  const spawnEncounter = async (encounterId: string) => {
    const { data, error } = await supabase.rpc('spawn_encounter', {
      p_encounter_id: encounterId,
      p_session_id: sessionId,
      p_dm_id: dmId,
    });

    if (error) {
      toast.error('Erro ao spawnar encontro: ' + error.message);
    } else if (data && data.length > 0) {
      const result = data[0];
      if (result.success) {
        toast.success(result.message);
        onSpawn?.(encounterId);
        onClose();
      } else {
        toast.error(result.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-gold" />
            <h2 className="font-display text-lg text-foreground">Builder de Encontros</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {!showForm && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border">
                <Button onClick={() => setShowForm(true)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Novo Encontro
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {encounters.length === 0 ? (
                  <div className="text-center py-12">
                    <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-display">Nenhum encontro salvo</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {encounters.map(encounter => (
                      <div
                        key={encounter.id}
                        className="bg-secondary/30 border border-border rounded-lg p-4 hover:border-gold/40 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-display font-bold">{encounter.name}</h3>
                            {encounter.description && (
                              <p className="text-xs text-muted-foreground mt-1">{encounter.description}</p>
                            )}
                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${
                              encounter.difficulty === 'fácil' ? 'bg-green-500/20 text-green-500' :
                              encounter.difficulty === 'médio' ? 'bg-yellow-500/20 text-yellow-500' :
                              encounter.difficulty === 'difícil' ? 'bg-orange-500/20 text-orange-500' :
                              'bg-red-500/20 text-red-500'
                            }`}>
                              {encounter.difficulty}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => spawnEncounter(encounter.id)} className="h-8">
                              <Play className="w-3 h-3 mr-1" /> Spawnar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteEncounter(encounter.id)} className="h-8 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {encounter.creatures.map((ec, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1 text-xs">
                              {ec.creature?.image_url && (
                                <img src={ec.creature.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                              )}
                              <span>{ec.count}x {ec.creature?.name || 'Desconhecido'}</span>
                              {ec.hidden && <span className="text-destructive">👁️</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showForm && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg">Novo Encontro</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Nome do Encontro</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emboscada de Goblins" />
                  </div>

                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descrição do encontro..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Dificuldade</Label>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full h-10 px-3 rounded-md border border-border bg-background">
                      <option value="fácil">Fácil</option>
                      <option value="médio">Médio</option>
                      <option value="difícil">Difícil</option>
                      <option value="mortal">Mortal</option>
                    </select>
                  </div>

                  <div>
                    <Label>Criaturas no Encontro</Label>
                    <div className="mt-2 space-y-2">
                      {encounterCreatures.map(ec => {
                        const creature = creatures.find(c => c.id === ec.creature_id);
                        return (
                          <div key={ec.creature_id} className="flex items-center gap-2 bg-secondary rounded-lg p-2">
                            {creature?.image_url && (
                              <img src={creature.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                            )}
                            <span className="flex-1 text-sm">{creature?.name}</span>
                            <Input
                              type="number"
                              value={ec.count}
                              onChange={(e) => updateCreatureCount(ec.creature_id, parseInt(e.target.value) || 0)}
                              className="w-16 h-8 text-xs"
                              min="1"
                            />
                            <Button
                              size="sm"
                              variant={ec.hidden ? 'destructive' : 'ghost'}
                              onClick={() => toggleCreatureHidden(ec.creature_id)}
                              className="h-8 w-8 p-0"
                              title={ec.hidden ? 'Oculto' : 'Visível'}
                            >
                              👁️
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeCreatureFromEncounter(ec.creature_id)}
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Adicionar Criatura</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {creatures.map(creature => (
                        <button
                          key={creature.id}
                          onClick={() => addCreatureToEncounter(creature.id)}
                          className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-gold/40 transition-all text-left"
                        >
                          {creature.image_url && (
                            <img src={creature.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="text-sm truncate">{creature.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveEncounter} className="flex-1">
                    <Save className="w-4 h-4 mr-2" /> Salvar Encontro
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
