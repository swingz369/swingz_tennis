import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import { StatCard } from '@/components/ui/stat-card';
import { Users, Calendar, DollarSign } from 'lucide-react';

describe('StatCard Component', () => {
  it('should render value and label', () => {
    render(<StatCard icon={Users} value={42} label="Aktive Mitglieder" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Aktive Mitglieder')).toBeInTheDocument();
  });

  it('should render string value', () => {
    render(<StatCard icon={DollarSign} value="€2,450" label="Umsatz" />);
    expect(screen.getByText('€2,450')).toBeInTheDocument();
  });

  it('should render sublabel when provided', () => {
    render(<StatCard icon={Calendar} value={12} label="Sessions" sublabel="+3 zum Vormonat" />);
    expect(screen.getByText('+3 zum Vormonat')).toBeInTheDocument();
  });

  it('should render icon', () => {
    const { container } = render(<StatCard icon={Users} value={5} label="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  // Die drei folgenden Tests hingen an der alten Optik: getönte Icon-Kachel
  // (`.h-10.w-10`), Zahl in `.text-2xl.font-bold`, Karte mit `.shadow-sm`.
  // Seit dem Design-Durchgang vom 18.08.2026 hat die Karte keinen Schatten und
  // das Icon keine Kachel mehr. Geprüft wird jetzt, dass die Klassen dort
  // ankommen, wo die Komponente sie hinreicht — nicht, wie sie aussehen.
  it('should apply custom iconClassName to the icon', () => {
    const { container } = render(
      <StatCard icon={Users} value={8} label="Test" iconClassName="text-info-600" />
    );
    expect(container.querySelector('svg')).toHaveClass('text-info-600');
  });

  it('should apply custom valueClassName to value', () => {
    const { container } = render(
      <StatCard icon={Users} value={99} label="Test" valueClassName="text-success-600" />
    );
    const valueElement = container.querySelector('.tabular-nums');
    expect(valueElement).toHaveClass('text-success-600');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StatCard icon={Users} value={3} label="Test" className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should handle zero value', () => {
    render(<StatCard icon={Users} value={0} label="Keine Mitglieder" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render multiple StatCards in a grid', () => {
    const { container } = render(
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users} value={10} label="A" />
        <StatCard icon={Calendar} value={20} label="B" />
        <StatCard icon={DollarSign} value={30} label="C" />
      </div>
    );
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();

    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards).toHaveLength(3);
  });
});
