'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Table, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * ExportButton — Dropdown button for exporting data in multiple formats.
 *
 * @example
 * <ExportButton
 *   formats={['csv', 'pdf']}
 *   onExportCSV={() => exportToCSV(data)}
 *   onExportPDF={() => exportToPDF(data)}
 * />
 */

type ExportFormat = 'csv' | 'pdf' | 'excel';

interface ExportButtonProps {
  /** Available export formats */
  formats?: ExportFormat[];
  /** Callback for CSV export */
  onExportCSV?: () => void | Promise<void>;
  /** Callback for PDF export */
  onExportPDF?: () => void | Promise<void>;
  /** Callback for Excel export */
  onExportExcel?: () => void | Promise<void>;
  /** Button label */
  label?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const FORMAT_CONFIG: Record<
  ExportFormat,
  { label: string; icon: typeof FileText; description: string }
> = {
  csv: { label: 'CSV', icon: Table, description: 'Komma-getrennte Werte' },
  pdf: { label: 'PDF', icon: FileText, description: 'Druckfähiges Dokument' },
  excel: { label: 'Excel', icon: Table, description: 'Microsoft Excel' },
};

export function ExportButton({
  formats = ['csv'],
  onExportCSV,
  onExportPDF,
  onExportExcel,
  label = 'Export',
  variant = 'outline',
  size = 'sm',
  className,
}: ExportButtonProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlers: Record<ExportFormat, (() => void | Promise<void>) | undefined> = {
    csv: onExportCSV,
    pdf: onExportPDF,
    excel: onExportExcel,
  };

  const handleExport = async (format: ExportFormat) => {
    const handler = handlers[format];
    if (!handler) {
      toast.error('Export nicht verfügbar');
      return;
    }

    setLoading(format);
    try {
      await handler();
      toast.success(`${FORMAT_CONFIG[format].label}-Export erfolgreich`);
    } catch {
      toast.error(`Fehler beim ${FORMAT_CONFIG[format].label}-Export`);
    } finally {
      setLoading(null);
    }
  };

  // Single format: render as a simple button
  if (formats.length === 1) {
    const format = formats[0];
    const Icon = loading === format ? Loader2 : Download;
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(format)}
        disabled={loading !== null}
        className={cn('gap-2', className)}
      >
        <Icon className={cn('h-4 w-4', loading === format && 'animate-spin')} />
        {label}
      </Button>
    );
  }

  // Multiple formats: render as dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={loading !== null}
          className={cn('gap-2', className)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => {
          const config = FORMAT_CONFIG[format];
          const Icon = config.icon;
          return (
            <DropdownMenuItem key={format} onClick={() => handleExport(format)}>
              <Icon className="h-4 w-4 mr-2" />
              <div>
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
