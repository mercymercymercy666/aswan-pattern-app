import { OPTIONS } from '../data/locations';

export default function OptionSwitch({ value, onChange }) {
  return (
    <div className="option-switch">
      {Object.entries(OPTIONS).map(([key, opt]) => (
        <button
          key={key}
          className={`option-btn ${Number(key) === value ? 'active' : ''}`}
          onClick={() => onChange(Number(key))}
        >
          {opt.label}
          <span className="stop-count">{opt.stops} stops</span>
        </button>
      ))}
    </div>
  );
}
