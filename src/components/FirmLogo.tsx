import { useEffect, useState, type CSSProperties } from "react";
import type { Firm } from "../data/firms";

export default function FirmLogo({ firm, large = false }: { firm: Firm; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [firm.logo]);
  return (
    <span
      className={`firm-logo ${large ? "firm-logo-large" : ""}`}
      style={{ "--firm-color": firm.color } as CSSProperties}
      aria-hidden="true"
    >
      {firm.logo && !failed ? (
        <img src={firm.logo} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{firm.monogram}</span>
      )}
    </span>
  );
}
