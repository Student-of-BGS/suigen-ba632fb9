import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FeatureControlProps {
  featureKey: string;
  isLocked: boolean;
  confidence: number; // 0-100
  onLockToggle: (key: string) => void;
  onConfidenceChange: (key: string, value: number) => void;
  hasValue: boolean;
}

const getConfidenceLabel = (value: number): string => {
  if (value <= 33) return "Low";
  if (value <= 66) return "Medium";
  return "High";
};

const getConfidenceColor = (value: number): string => {
  if (value <= 33) return "text-yellow-500";
  if (value <= 66) return "text-orange-500";
  return "text-green-500";
};

export const FeatureControl = ({
  featureKey,
  isLocked,
  confidence,
  onLockToggle,
  onConfidenceChange,
  hasValue,
}: FeatureControlProps) => {
  return (
    <div className="flex items-center gap-2 mt-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0 transition-colors",
                isLocked 
                  ? "text-primary bg-primary/20 hover:bg-primary/30" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onLockToggle(featureKey)}
              disabled={!hasValue}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isLocked ? "Locked - will not change on regeneration" : "Unlocked - can vary on regeneration"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1 flex items-center gap-2">
        <Slider
          value={[confidence]}
          onValueChange={(v) => onConfidenceChange(featureKey, v[0])}
          max={100}
          step={1}
          className="flex-1"
          disabled={!hasValue}
        />
        <span className={cn("text-xs font-medium w-14 text-right", hasValue ? getConfidenceColor(confidence) : "text-muted-foreground")}>
          {getConfidenceLabel(confidence)}
        </span>
      </div>
    </div>
  );
};

export default FeatureControl;
