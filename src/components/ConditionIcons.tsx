import { motion } from 'framer-motion';

interface ConditionIconsProps {
  conditions: Array<{ icon: string; condition_name: string; duration: number | null }>;
  onClick?: () => void;
  uiScale?: number;
}

export default function ConditionIcons({ conditions, onClick, uiScale = 1 }: ConditionIconsProps) {
  if (conditions.length === 0) return null;

  return (
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none">
      <div style={{ transform: `scale(${uiScale})`, transformOrigin: 'center bottom' }}>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-1 pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {conditions.slice(0, 5).map((condition, idx) => (
          <motion.div
            key={idx}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="relative bg-card/95 border border-border rounded-full w-7 h-7 flex items-center justify-center text-base shadow-lg cursor-pointer hover:scale-110 transition-transform"
            title={`${condition.condition_name}${condition.duration ? ` (${condition.duration} turnos)` : ''}`}
          >
            {condition.icon}
            {condition.duration && (
              <span className="absolute -bottom-1 -right-1 bg-gold text-background rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {condition.duration}
              </span>
            )}
          </motion.div>
        ))}
        {conditions.length > 5 && (
          <div className="bg-card/95 border border-border rounded-full w-7 h-7 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            +{conditions.length - 5}
          </div>
        )}
      </motion.div>
      </div>
    </div>
  );
}
