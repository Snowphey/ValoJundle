import React from "react";
import "./ColorIndicator.css";

const ArrowPolygon = ({ direction }: { direction: "up" | "down" }) => (
  <span
    className="card-arrow-svg"
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: direction === "up" ? "rotate(0deg)" : "rotate(180deg)",
      zIndex: 1,
      pointerEvents: "none",
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: "block" }}>
      <polygon
        points="97,40 80,40 80,95 20,95 20,40 3,40 50,5"
        fill="#7a0c0c"
      />
    </svg>
  </span>
);

const ColorIndicator: React.FC = () => (
  <div className="color-indicator legend-box">
    <div className="color-indicator-title">Indicateurs de couleur</div>
    <div className="color-indicator-legend-row">
      <span className="color-label-group">
        <span className="color correct" title="Correct"></span>
        <span className="color-indicator-label">Correct</span>
      </span>
      <span className="color-label-group">
        <span className="color partial" title="Partiel"></span>
        <span className="color-indicator-label">Partiel</span>
      </span>
      <span className="color-label-group">
        <span className="color incorrect" title="Incorrect"></span>
        <span className="color-indicator-label">Incorrect</span>
      </span>
      <span className="color-label-group">
        <span className="color higher" title="Supérieur" style={{ position: 'relative' }}>
          <ArrowPolygon direction="up" />
        </span>
        <span className="color-indicator-label">Supérieur</span>
      </span>
      <span className="color-label-group">
        <span className="color lower" title="Inférieur" style={{ position: 'relative' }}>
          <ArrowPolygon direction="down" />
        </span>
        <span className="color-indicator-label">Inférieur</span>
      </span>
    </div>
  </div>
);

export default ColorIndicator;
