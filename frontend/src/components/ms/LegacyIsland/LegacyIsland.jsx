/**
 * Ostrov pro ještě nepřevedenou obrazovku uvnitř nového rámce: vykreslí staré
 * obaly, na kterých stojí staré CSS (ve vrstvě legacy), aby obrazovka vypadala
 * jako dnes.
 * - admin: admin-layout-content s odsazením a container-fluid
 *
 * Jediná komponenta kitu se třídami Bootstrapu – check:styles ji má jako
 * výjimku. Na předcích ostrova nesmí být transform, filter, backdrop-filter,
 * contain ani will-change (rozbily by position:fixed starých modalů).
 * Smaže se ve Fázi 6 spolu se starým CSS.
 */
export default function LegacyIsland({ variant, children }) {
  if (variant === 'admin') {
    return (
      <div className="admin-layout-content p-4">
        <div className="container-fluid">{children}</div>
      </div>
    );
  }
  throw new Error(`LegacyIsland: neznámá varianta „${variant}“`);
}
