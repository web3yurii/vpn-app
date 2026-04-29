import React from "react";
import * as Flags from "country-flag-icons/react/3x2";

type FlagComponent = React.ComponentType<{ width?: number; height?: number; style?: React.CSSProperties }>;
const FlagMap = Flags as unknown as Record<string, FlagComponent>;

interface Props {
  code: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

const FlagIcon: React.FC<Props> = ({ code, width = 20, height, style }) => {
  const Flag = FlagMap[code.toUpperCase()];
  if (!Flag) {
    return (
      <span style={{ display: "inline-block", width, fontSize: "10px", color: "#718096", textAlign: "center" }}>
        {code.toUpperCase()}
      </span>
    );
  }
  return (
    <Flag
      width={width}
      height={height ?? Math.round((width * 2) / 3)}
      style={{ borderRadius: "2px", flexShrink: 0, ...style }}
    />
  );
};

export default FlagIcon;
