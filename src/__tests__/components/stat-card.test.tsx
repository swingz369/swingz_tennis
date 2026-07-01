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

  it('should apply custom iconClassName', () => {
    const { container } = render(
      <StatCard icon={Users} value={8} label="Test" iconClassName="bg-blue-100" />
    );
    const iconContainer = container.querySelector('.h-10.w-10');
    expect(iconContainer).toHaveClass('bg-blue-100');
  });

  it('should apply custom valueClassName to value and icon', () => {
    const { container } = render(
      <StatCard icon={Users} value={99} label="Test" valueClassName="text-green-600" />
    );
    const valueElement = container.querySelector('.text-2xl.font-bold');
    expect(valueElement).toHaveClass('text-green-600');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StatCard icon={Users} value={3} label="Test" className="custom-class" />
    );
    const card = container.querySelector('.shadow-sm');
    expect(card).toHaveClass('custom-class');
  });

  it('should render with default blue icon background', () => {
    const { container } = render(<StatCard icon={Users} value={7} label="Test" />);
    const iconContainer = container.querySelector('.h-10.w-10');
    expect(iconContainer).toHaveClass('bg-blue-50');
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

    const cards = container.querySelectorAll('.shadow-sm');
    expect(cards).toHaveLength(3);
  });
});
