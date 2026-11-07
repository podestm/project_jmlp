import { Button, Tooltip } from '../../../../ms/index.js';

/**
 * Vstup do evidence SLČR v záhlaví Výsledků. Jen online: offline je
 * tlačítko vypnuté a proč, řekne Tooltip.
 */
export default function SlcrEntry({ isOnline, onOpen }) {
  return (
    <Tooltip text={isOnline ? '' : 'Vyžaduje připojení'}>
      <Button size="sm" icon="cloud-upload" disabled={!isOnline} onClick={onOpen}>
        Evidence SLČR
      </Button>
    </Tooltip>
  );
}
