import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '../test-utils';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const [confirm, dialog] = useConfirmDialog();
  return (
    <>
      <button
        onClick={async () =>
          onResult(await confirm({ title: 'Löschen?', confirmLabel: 'Ja, löschen' }))
        }
      >
        auslösen
      </button>
      {dialog}
    </>
  );
}

describe('useConfirmDialog', () => {
  it('liefert true bei Bestätigung', async () => {
    let result: boolean | undefined;
    render(<Harness onResult={(ok) => (result = ok)} />);
    fireEvent.click(screen.getByText('auslösen'));
    fireEvent.click(await screen.findByText('Ja, löschen'));
    await waitFor(() => expect(result).toBe(true));
  });

  it('liefert false bei Abbrechen', async () => {
    let result: boolean | undefined;
    render(<Harness onResult={(ok) => (result = ok)} />);
    fireEvent.click(screen.getByText('auslösen'));
    fireEvent.click(await screen.findByText('Abbrechen'));
    await waitFor(() => expect(result).toBe(false));
  });
});
