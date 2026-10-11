import { EmptyState as MsEmptyState } from '../ms/index.js';

/**
 * Prázdný seznam nebo tabulka na obrazovce, která ještě není převedená na
 * Modrou stopu. Vykreslí kit EmptyState; kořen má .ms-scope, aby ve starém
 * okolí platil reset a písma nového UI.
 *
 * @param {string} icon - název ikony z components/ms/Icon/icons.js, např. 'folder'
 * @param {string} title
 * @param {string} [hint] - doplňující věta
 * @param {React.ReactNode} [action] - tlačítko s další akcí
 */
export default function EmptyState({ icon = 'inbox', title, hint, action }) {
  return <MsEmptyState icon={icon} title={title} hint={hint} action={action} className="ms-scope" />;
}
