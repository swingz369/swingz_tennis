'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { AlertTriangle, CheckCircle, Trash2, XCircle } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'default' | 'destructive' | 'brand';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

const variantStyles: Record<ConfirmVariant, { icon: React.ElementType; buttonClass: string }> = {
  danger: {
    icon: Trash2,
    buttonClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
  destructive: {
    icon: Trash2,
    buttonClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
  },
  warning: { icon: AlertTriangle, buttonClass: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  default: { icon: XCircle, buttonClass: '' },
  brand: {
    icon: CheckCircle,
    buttonClass: 'bg-brand-primary hover:bg-brand-primary/90 text-white',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const IconComponent = variantStyles[variant].icon;

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${
                variant === 'danger' || variant === 'destructive'
                  ? 'bg-destructive/10'
                  : variant === 'warning'
                    ? 'bg-yellow-100'
                    : variant === 'brand'
                      ? 'bg-brand-primary/10'
                      : 'bg-muted'
              }`}
            >
              <IconComponent
                className={`h-5 w-5 ${
                  variant === 'danger' || variant === 'destructive'
                    ? 'text-destructive'
                    : variant === 'warning'
                      ? 'text-yellow-600'
                      : variant === 'brand'
                        ? 'text-brand-primary'
                        : 'text-muted-foreground'
                }`}
              />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>
        {children && <div className="py-2">{children}</div>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <LoadingButton
            loading={loading}
            onClick={handleConfirm}
            className={variantStyles[variant].buttonClass}
            variant={variant === 'danger' || variant === 'destructive' ? 'destructive' : 'default'}
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
