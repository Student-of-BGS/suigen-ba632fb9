import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { FeatureControl } from "./FeatureControl";

interface FeatureFieldProps {
  label: string;
  featureKey: string;
  isLocked: boolean;
  confidence: number;
  onLockToggle: (key: string) => void;
  onConfidenceChange: (key: string, value: number) => void;
  hasValue: boolean;
  children: ReactNode;
  className?: string;
}

export const FeatureField = ({
  label,
  featureKey,
  isLocked,
  confidence,
  onLockToggle,
  onConfidenceChange,
  hasValue,
  children,
  className = "",
}: FeatureFieldProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
      <FeatureControl
        featureKey={featureKey}
        isLocked={isLocked}
        confidence={confidence}
        onLockToggle={onLockToggle}
        onConfidenceChange={onConfidenceChange}
        hasValue={hasValue}
      />
    </div>
  );
};

export default FeatureField;
