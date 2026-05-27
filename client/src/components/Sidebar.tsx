interface Props {
  onReset: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ onReset, isOpen, onToggle }: Props) {
  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        ☰
      </button>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onToggle}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">MAPRO</div>
          <div className="tagline">AI Debater · Bahasa Indonesia</div>
        </div>
        <div className="divider" />
        <button className="reset-btn" onClick={onReset}>
          ↺ &nbsp;Reset percakapan
        </button>
      </aside>
    </>
  );
}
