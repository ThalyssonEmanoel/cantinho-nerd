import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sword, ChevronRight, ChevronLeft, Trash2, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CombatInitiative {
  id: string;
  character_name: string;
  initiative_total: number;
  is_active: boolean;
  turn_order: number;
  avatar_url?: string;
  hp_current?: number;
  hp_max?: number;
}

interface CombatState {
  is_active: boolean;
  current_round: number;
}

interface InitiativePanelProps {
  sessionId: string;
  isMaster: boolean;
}

export default function InitiativePanel({ sessionId, isMaster }: InitiativePanelProps) {
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [initiatives, setInitiatives] = useState<CombatInitiative[]>([]);
  const stateChannelRef = useRef<any>(null);
  const initiativeChannelRef = useRef<any>(null);
  const [manualName, setManualName] = useState("");
  const [manualInitiative, setManualInitiative] = useState("");
  const [showAddManual, setShowAddManual] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCombatState();
    loadInitiatives();

    let mounted = true;
    (async () => {
      try {
        const stateChannel = supabase.channel(`combat_state:${sessionId}`);
        stateChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "combat_state", filter: `session_id=eq.${sessionId}` },
          (payload) => {
            console.log('Realtime event (combat_state):', payload);
            loadCombatState();
          }
        );
        await stateChannel.subscribe();
        stateChannelRef.current = stateChannel;

        const initiativeChannel = supabase.channel(`combat_initiative:${sessionId}`);
        initiativeChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "combat_initiative", filter: `session_id=eq.${sessionId}` },
          (payload) => {
            console.log('Realtime event (combat_initiative):', payload);
            loadInitiatives();
          }
        );
        await initiativeChannel.subscribe();
        initiativeChannelRef.current = initiativeChannel;
      } catch (err) {
        console.error('Erro ao configurar canais Realtime:', err);
      }
    })();

    return () => {
      if (stateChannelRef.current) supabase.removeChannel(stateChannelRef.current);
      if (initiativeChannelRef.current) supabase.removeChannel(initiativeChannelRef.current);
    };
  }, [sessionId]);

  const loadCombatState = async () => {
    const { data } = await supabase.from("combat_state").select("*").eq("session_id", sessionId).maybeSingle();
    setCombatState(data);
  };

  const loadInitiatives = async () => {
    const { data } = await supabase.from("combat_initiative").select("*").eq("session_id", sessionId).order("turn_order");
    setInitiatives(data || []);
  };

  const startCombat = async () => {
    console.log('Iniciando combate para sessão:', sessionId);
    
    const { data, error } = await supabase.from("combat_state").upsert({
      session_id: sessionId,
      is_active: true,
      current_round: 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'session_id'
    }).select();

    console.log('Resultado do upsert:', { data, error });

    if (error) {
      console.error('Erro ao iniciar combate:', error);
      toast({ title: "Erro ao iniciar combate", description: error.message, variant: "destructive" });
    } else {
      console.log('Combate iniciado com sucesso!');
      toast({ title: "⚔️ Combate iniciado! Jogadores, rolem Iniciativa na ficha." });
      await loadCombatState();
    }
  };

  const nextTurn = async () => {
    try {
      // reload fresh list to avoid stale state
      const { data: latest } = await supabase.from('combat_initiative').select('*').eq('session_id', sessionId).order('turn_order', { ascending: true });
      const list = latest || [];
      if (list.length === 0) return;

      const activeIndex = list.findIndex((i) => i.is_active);
      const nextIndex = (activeIndex + 1) % list.length;

      // Turn off all, then enable next. Await each step and check errors.
      const { error: errOff } = await supabase.from('combat_initiative').update({ is_active: false }).eq('session_id', sessionId);
      if (errOff) {
        console.error('Erro ao desativar iniciativas:', errOff);
        toast({ title: 'Erro ao avançar turno', variant: 'destructive' });
        return;
      }

      const { error: errOn } = await supabase.from('combat_initiative').update({ is_active: true }).eq('id', list[nextIndex].id);
      if (errOn) {
        console.error('Erro ao ativar próximo combatente:', errOn);
        toast({ title: 'Erro ao ativar próximo', variant: 'destructive' });
        return;
      }

      // If we wrapped around, increment round
      if (nextIndex === 0) {
        await supabase.from('combat_state').update({ current_round: (combatState?.current_round || 1) + 1 }).eq('session_id', sessionId);
      }

      await loadInitiatives();
      await loadCombatState();
    } catch (err) {
      console.error('nextTurn error:', err);
      toast({ title: 'Erro ao avançar turno', variant: 'destructive' });
    }
  };

  const previousTurn = async () => {
    try {
      const { data: latest } = await supabase.from('combat_initiative').select('*').eq('session_id', sessionId).order('turn_order', { ascending: true });
      const list = latest || [];
      if (list.length === 0) return;

      const activeIndex = list.findIndex((i) => i.is_active);
      let prevIndex = activeIndex - 1;
      let decrementedRound = false;
      if (prevIndex < 0) {
        prevIndex = list.length - 1;
        decrementedRound = true;
      }

      const { error: errOff } = await supabase.from('combat_initiative').update({ is_active: false }).eq('session_id', sessionId);
      if (errOff) {
        console.error('Erro ao desativar iniciativas:', errOff);
        toast({ title: 'Erro ao retroceder turno', variant: 'destructive' });
        return;
      }

      const { error: errOn } = await supabase.from('combat_initiative').update({ is_active: true }).eq('id', list[prevIndex].id);
      if (errOn) {
        console.error('Erro ao ativar turno anterior:', errOn);
        toast({ title: 'Erro ao ativar turno anterior', variant: 'destructive' });
        return;
      }

      if (decrementedRound) {
        const newRound = Math.max(1, (combatState?.current_round || 1) - 1);
        await supabase.from('combat_state').update({ current_round: newRound }).eq('session_id', sessionId);
      }

      await loadInitiatives();
      await loadCombatState();
    } catch (err) {
      console.error('previousTurn error:', err);
      toast({ title: 'Erro ao retroceder turno', variant: 'destructive' });
    }
  };

  const clearCombat = async () => {
    try {
      await supabase.from('combat_initiative').delete().eq('session_id', sessionId);
      await supabase.from('combat_state').update({ is_active: false, current_round: 1 }).eq('session_id', sessionId);
      await loadInitiatives();
      await loadCombatState();
      toast({ title: 'Combate encerrado' });
    } catch (err) {
      console.error('Erro ao limpar combate:', err);
      toast({ title: 'Erro ao limpar combate', variant: 'destructive' });
    }
  };

  const addManualCombatant = async () => {
    if (!manualName.trim() || !manualInitiative.trim()) {
      toast({ title: "Preencha nome e iniciativa", variant: "destructive" });
      return;
    }

    const total = parseInt(manualInitiative);
    if (isNaN(total)) {
      toast({ title: "Iniciativa deve ser um número", variant: "destructive" });
      return;
    }

    const { data: allEntries } = await supabase
      .from("combat_initiative")
      .select("turn_order")
      .eq("session_id", sessionId)
      .order("turn_order", { ascending: false })
      .limit(1);

    const nextOrder = (allEntries?.[0]?.turn_order ?? 0) + 1;

    const { error } = await supabase.from("combat_initiative").insert({
      session_id: sessionId,
      combatant_type: "npc",
      character_name: manualName.trim(),
      initiative_roll: total,
      initiative_bonus: 0,
      initiative_total: total,
      turn_order: nextOrder,
      is_active: false,
    });

    if (error) {
      toast({ title: "Erro ao adicionar", variant: "destructive" });
      return;
    }

    // Reordena automaticamente
    const { data: allInitiatives } = await supabase
      .from("combat_initiative")
      .select("*")
      .eq("session_id", sessionId)
      .order("initiative_total", { ascending: false });

    if (allInitiatives) {
      for (let i = 0; i < allInitiatives.length; i++) {
        await supabase
          .from("combat_initiative")
          .update({ turn_order: i + 1 })
          .eq("id", allInitiatives[i].id);
      }
    }

    setManualName("");
    setManualInitiative("");
    setShowAddManual(false);
    toast({ title: "Combatente adicionado!" });
  };

  const removeCombatant = async (id: string) => {
    const { error } = await supabase.from("combat_initiative").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } else {
      toast({ title: "Removido da iniciativa" });
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    
    const current = initiatives[index];
    const above = initiatives[index - 1];
    
    await supabase.from("combat_initiative").update({ turn_order: index }).eq("id", current.id);
    await supabase.from("combat_initiative").update({ turn_order: index + 1 }).eq("id", above.id);
  };

  const moveDown = async (index: number) => {
    if (index === initiatives.length - 1) return;
    
    const current = initiatives[index];
    const below = initiatives[index + 1];
    
    await supabase.from("combat_initiative").update({ turn_order: index + 2 }).eq("id", current.id);
    await supabase.from("combat_initiative").update({ turn_order: index + 1 }).eq("id", below.id);
  };

  if (!combatState?.is_active && !isMaster) return null;
  if (!combatState && !isMaster) return null;

  return (
    <Card className="p-4 bg-slate-900/95 border-amber-600 min-w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sword className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-amber-500">Iniciativa</h3>
          {combatState?.is_active && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-bold text-amber-400">Rodada {combatState.current_round}</span>
            </div>
          )}
        </div>
        {isMaster && combatState?.is_active && (
          <Button onClick={() => setShowAddManual(!showAddManual)} size="sm" variant="outline" className="h-7">
            <Plus className="w-3 h-3" />
          </Button>
        )}
      </div>

      {!combatState?.is_active && isMaster && (
        <Button onClick={startCombat} className="w-full bg-amber-600 hover:bg-amber-700">
          Iniciar Combate
        </Button>
      )}

      {combatState?.is_active && (
        <>
          {isMaster && showAddManual && (
            <div className="mb-3 p-3 bg-slate-800 rounded border border-amber-600/30">
              <div className="text-xs text-amber-400 mb-2">Adicionar Monstro/NPC</div>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Nome"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Iniciativa"
                  type="number"
                  value={manualInitiative}
                  onChange={(e) => setManualInitiative(e.target.value)}
                  className="h-8 text-sm w-24"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addManualCombatant} size="sm" className="flex-1 h-7 bg-amber-600 hover:bg-amber-700">
                  Adicionar
                </Button>
                <Button onClick={() => setShowAddManual(false)} size="sm" variant="outline" className="h-7">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {initiatives.map((init, index) => (
              <div
                key={init.id}
                className={`p-3 rounded ${init.is_active ? "bg-amber-600/30 border-2 border-amber-500" : "bg-slate-800"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  {isMaster && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === initiatives.length - 1}
                        className="disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg font-bold text-amber-400">#{index + 1}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{init.character_name}</div>
                      {init.hp_current !== undefined && (
                        <div className="text-sm text-slate-400">
                          {init.hp_current}/{init.hp_max} PV
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xl font-bold text-amber-500">{init.initiative_total}</span>
                  {isMaster && (
                    <button
                      onClick={() => removeCombatant(init.id)}
                      className="ml-2 text-red-400 hover:text-red-300"
                      title="Remover"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isMaster && (
            <div className="flex gap-2">
              <Button onClick={previousTurn} variant="outline" size="sm" className="flex-1">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button onClick={nextTurn} size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700">
                <ChevronRight className="w-4 h-4" /> Próximo
              </Button>
              <Button onClick={clearCombat} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
